import { appendFile, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dataDir } from "../paths";
import { CIV_IDS } from "../engine/types";
import type { Action, CivId, GameEvent, World } from "../engine/types";
import type { DisplayEvent } from "./events";

function tracesDir(): string {
  return path.join(dataDir(), "traces");
}
function savesDir(): string {
  return path.join(dataDir(), "saves");
}

// ── Identificadores e caminhos seguros ─────────────────────────────────────

const GAME_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidGameId(gameId: string): boolean {
  return GAME_ID_RE.test(gameId);
}

export class InvalidGameIdError extends Error {
  constructor(gameId: string) {
    super(`gameId inválido: ${JSON.stringify(gameId).slice(0, 80)} (esperado ${GAME_ID_RE})`);
  }
}

/**
 * Resolve o caminho de um arquivo de partida com defesa em profundidade:
 * o gameId precisa casar com a allowlist E o caminho resolvido precisa
 * continuar dentro do diretório-base (anti path traversal).
 */
function safeGameFile(base: string, gameId: string, ext: string): string {
  if (!isValidGameId(gameId)) throw new InvalidGameIdError(gameId);
  const full = path.resolve(base, `${gameId}${ext}`);
  if (!full.startsWith(path.resolve(base) + path.sep)) throw new InvalidGameIdError(gameId);
  return full;
}

/** Escrita atômica: grava em arquivo temporário e renomeia por cima. */
async function writeFileAtomic(file: string, contents: string): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, file);
}

// ── Trace (JSON Lines por tick) ─────────────────────────────────────────────

export interface TraceRecord {
  tick: number;
  decisions: {
    civ: CivId;
    reasoning: string;
    actions: Action[];
    passed: boolean;
    errors: string[];
  }[];
  events: GameEvent[];
  /** Manchete opcional do narrador (ver orchestrator/narrator.ts). */
  narration?: string;
}

/** Anexa um registro do tick ao trace da partida (JSON Lines). */
export async function appendTrace(gameId: string, record: TraceRecord): Promise<void> {
  await mkdir(tracesDir(), { recursive: true });
  await appendFile(safeGameFile(tracesDir(), gameId, ".jsonl"), `${JSON.stringify(record)}\n`, "utf8");
}

// ── Saves versionados e validados ───────────────────────────────────────────

export const SAVE_SCHEMA_VERSION = 1;

const ResourcesSchema = z.object({
  food: z.number().finite(),
  gold: z.number().finite(),
  science: z.number().finite(),
});

const CivilizationSchema = z
  .object({
    id: z.enum([...CIV_IDS] as [CivId, ...CivId[]]),
    persona: z.string(),
    resources: ResourcesSchema,
    tech: z.array(z.string()),
    researching: z.string().nullable(),
    cities: z.array(z.object({ id: z.string(), x: z.number(), y: z.number(), population: z.number() }).passthrough()),
    armies: z.array(z.object({ id: z.string(), x: z.number(), y: z.number(), strength: z.number() }).passthrough()),
    memory: z.string(),
    alive: z.boolean(),
  })
  .passthrough();

const WorldSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    seed: z.number().finite(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    map: z.array(z.array(z.object({ x: z.number(), y: z.number() }).passthrough())),
    civilizations: z.object({
      rome: CivilizationSchema,
      egypt: CivilizationSchema,
      greece: CivilizationSchema,
      mali: CivilizationSchema,
    }),
    diplomacy: z.record(z.string(), z.enum(["peace", "war", "alliance", "trade"])),
    events: z.array(z.object({ type: z.string() }).passthrough()),
  })
  .passthrough();

const SaveEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  savedAt: z.string(),
  world: z.unknown(),
});

export class CorruptedSaveError extends Error {
  readonly code = "SAVE_CORRUPTED";
}
export class UnsupportedSaveVersionError extends Error {
  readonly code = "SAVE_VERSION_UNSUPPORTED";
  constructor(version: number) {
    super(`versão de save não suportada: ${version} (suportada: ≤ ${SAVE_SCHEMA_VERSION})`);
  }
}

/** Salva um snapshot completo do mundo (envelope versionado, escrita atômica). */
export async function saveWorld(gameId: string, world: World): Promise<void> {
  await mkdir(savesDir(), { recursive: true });
  const envelope = { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(), world };
  await writeFileAtomic(safeGameFile(savesDir(), gameId, ".json"), JSON.stringify(envelope));
}

function parseWorld(raw: string): World {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new CorruptedSaveError(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Formato atual: envelope versionado. Formato legado (pré-versionamento):
  // o próprio World na raiz do arquivo — migrado de forma transparente.
  const envelope = SaveEnvelopeSchema.safeParse(data);
  const candidate = envelope.success ? envelope.data.world : data;
  if (envelope.success && envelope.data.schemaVersion > SAVE_SCHEMA_VERSION) {
    throw new UnsupportedSaveVersionError(envelope.data.schemaVersion);
  }

  const world = WorldSchema.safeParse(candidate);
  if (!world.success) {
    throw new CorruptedSaveError(`snapshot não passou na validação: ${world.error.issues[0]?.message ?? "?"}`);
  }
  return world.data as unknown as World;
}

/**
 * Carrega um snapshot salvo. `null` apenas quando o arquivo não existe;
 * save corrompido ou de versão não suportada lança erro explícito
 * (CorruptedSaveError / UnsupportedSaveVersionError) — falha visível.
 */
export async function loadWorld(gameId: string): Promise<World | null> {
  let raw: string;
  try {
    raw = await readFile(safeGameFile(savesDir(), gameId, ".json"), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return parseWorld(raw);
}

/** Lê todo o histórico de ticks de uma partida (vazio se não existir). */
export async function readTrace(gameId: string): Promise<TraceRecord[]> {
  try {
    const raw = await readFile(safeGameFile(tracesDir(), gameId, ".jsonl"), "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as TraceRecord);
  } catch (err) {
    if (err instanceof InvalidGameIdError) throw err;
    return [];
  }
}

export interface SaveInfo {
  gameId: string;
  tick: number;
  seed: number;
  updatedAt: string;
}

/** Lista as partidas salvas em disco (mais recente primeiro). */
export async function listSaves(): Promise<SaveInfo[]> {
  let files: string[];
  try {
    files = await readdir(savesDir());
  } catch {
    return [];
  }

  const infos: SaveInfo[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const gameId = file.replace(/\.json$/, "");
    if (!isValidGameId(gameId)) continue;
    const full = path.join(savesDir(), file);
    try {
      const [raw, st] = await Promise.all([readFile(full, "utf8"), stat(full)]);
      const world = parseWorld(raw);
      infos.push({ gameId, tick: world.tick, seed: world.seed, updatedAt: st.mtime.toISOString() });
    } catch {
      // arquivo corrompido/parcial — não aparece na lista (mas o load explícito reporta o erro)
    }
  }
  return infos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface CivLastTurn {
  reasoning: string;
  actions: Action[];
  passed: boolean;
  errors: string[];
}

export interface TraceSummary {
  /** Todos os eventos (+ narrações) da partida, em ordem cronológica. */
  timeline: DisplayEvent[];
  /** Última decisão registrada de cada civilização. */
  civs: Partial<Record<CivId, CivLastTurn>>;
}

/**
 * Reduz o trace completo a um resumo pronto para repor o estado de um
 * cliente que acabou de conectar (ou reconectar): a timeline inteira (na
 * mesma forma — GameEvent[] + narração sintética — que o streaming ao vivo
 * usa em `tick_end`) e o último raciocínio/ações de cada civilização.
 */
export function summarizeTrace(records: TraceRecord[]): TraceSummary {
  const timeline: DisplayEvent[] = [];
  const civs: Partial<Record<CivId, CivLastTurn>> = {};

  for (const record of records) {
    timeline.push(...record.events);
    if (record.narration) timeline.push({ type: "narration", text: record.narration });
    for (const d of record.decisions) {
      civs[d.civ] = { reasoning: d.reasoning, actions: d.actions, passed: d.passed, errors: d.errors };
    }
  }

  return { timeline, civs };
}

/** Atalho: lê o trace de uma partida e já devolve o resumo (timeline + civs). */
export async function readTraceSummary(gameId: string): Promise<TraceSummary> {
  return summarizeTrace(await readTrace(gameId));
}
