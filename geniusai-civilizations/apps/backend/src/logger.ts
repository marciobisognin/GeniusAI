/**
 * Logger estruturado do backend (RNF-003). Toda chamada carrega um conjunto
 * fixo de campos correlacionáveis — `requestId`, `gameId`, `tick`,
 * `civilizationId`, `operation`, `durationMs`, `errorCode` — mesmo quando a
 * saída no terminal é o formato compacto e legível de sempre.
 *
 * Dois formatos de saída, escolhidos por `LOG_FORMAT` (padrão `pretty`):
 * - `pretty` — uma linha legível no terminal (preserva o "watchable" do
 *   produto: acompanhar a simulação pelo terminal do host, não só o browser).
 * - `json`   — uma linha JSON por evento, para pipelines de observabilidade
 *   (`LOG_FORMAT=json npm run dev:backend`).
 */

export type LogLevel = "info" | "warn" | "error";

/** Campos estruturados padronizados (RNF-003) — todos opcionais por chamada. */
export interface LogFields {
  requestId?: string;
  gameId?: string;
  tick?: number;
  civilizationId?: string;
  operation?: string;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

export interface LogEntry extends LogFields {
  level: LogLevel;
  msg: string;
  time: string;
}

function currentFormat(): "pretty" | "json" {
  return (process.env.LOG_FORMAT ?? "pretty").toLowerCase() === "json" ? "json" : "pretty";
}

const RESERVED = new Set(["level", "msg", "time"]);

/** Renderiza uma linha compacta e legível: `[level] mensagem (chave=valor …)`. */
function renderPretty(entry: LogEntry): string {
  const extras = Object.entries(entry)
    .filter(([key, value]) => !RESERVED.has(key) && value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  return extras.length > 0 ? `[${entry.level}] ${entry.msg} (${extras.join(" ")})` : `[${entry.level}] ${entry.msg}`;
}

/** Ponto único de emissão — usado pelos helpers abaixo e testável isoladamente. */
export function emit(level: LogLevel, msg: string, fields: LogFields = {}): void {
  const entry: LogEntry = { level, msg, time: new Date().toISOString(), ...fields };
  const line = currentFormat() === "json" ? JSON.stringify(entry) : renderPretty(entry);
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields?: LogFields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields): void => emit("error", msg, fields),
};

/** Id curto e legível para correlacionar as linhas de UMA conexão/requisição. */
export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}
