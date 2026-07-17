import type { OrgNode } from "@/lib/data/org-chart";
import { createEmptyNode } from "@/lib/data/org-chart";

export interface ImportResult {
  nodes: OrgNode[];
  warnings: string[];
  format: "json" | "csv" | "texto";
}

interface RawEntry {
  titulo: string;
  area: string;
  responsabilidades: string[];
  reportaATitulo: string | null;
}

const TITLE_KEYS = ["titulo", "cargo", "funcao", "nome", "title", "role", "position"];
const AREA_KEYS = ["area", "departamento", "setor", "department", "team"];
const RESP_KEYS = ["responsabilidades", "atribuicoes", "responsibilities", "tasks", "atribuicao"];
const PARENT_KEYS = [
  "reportaa", "reporta_a", "reporta-se-a", "reportase", "superior", "parent",
  "reportsto", "reports_to", "manager", "chefe", "reporta",
];
const ROOT_MARKERS = new Set(["", "topo", "nenhum", "none", "raiz", "-", "n/a", "na"]);

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function splitList(raw: string): string[] {
  for (const d of ["|", ";", ","]) {
    if (raw.includes(d)) return raw.split(d).map((s) => s.trim()).filter(Boolean);
  }
  return [raw.trim()].filter(Boolean);
}

function resolveEntries(raw: RawEntry[], warnings: string[], format: ImportResult["format"]): ImportResult {
  const deduped = raw.filter((r) => r.titulo.trim().length > 0);
  if (deduped.length === 0) {
    warnings.push("Nenhum cargo com título válido foi encontrado.");
    return { nodes: [], warnings, format };
  }

  const nodes: OrgNode[] = deduped.map((r) => ({
    ...createEmptyNode(),
    titulo: r.titulo,
    area: r.area,
    responsabilidades: r.responsabilidades,
  }));

  const byNormTitle = new Map<string, string>();
  nodes.forEach((n, i) => {
    const key = normalizeKey(deduped[i].titulo);
    if (!byNormTitle.has(key)) byNormTitle.set(key, n.id);
  });

  let unresolved = 0;
  nodes.forEach((n, i) => {
    const parentTitulo = deduped[i].reportaATitulo;
    if (!parentTitulo) return;
    const key = normalizeKey(parentTitulo);
    if (ROOT_MARKERS.has(key)) return;
    const parentId = byNormTitle.get(key);
    if (parentId && parentId !== n.id) {
      n.parentId = parentId;
    } else {
      unresolved += 1;
    }
  });

  if (unresolved > 0) {
    warnings.push(
      `${unresolved} cargo(s) citam um superior que não foi encontrado na lista enviada — ficaram no topo do organograma; ajuste manualmente o campo "Reporta-se a".`,
    );
  }

  return { nodes, warnings, format };
}

// ---------- JSON ----------

type RawJsonEntry = Record<string, unknown>;
const CHILDREN_KEYS = ["filhos", "subordinados", "children", "subalternos"];

function pick(obj: RawJsonEntry, keys: string[]): unknown {
  for (const key of Object.keys(obj)) {
    if (keys.includes(normalizeKey(key)) && obj[key] != null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function flattenJsonTree(entries: RawJsonEntry[], parentTitulo: string | null, acc: RawEntry[]) {
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const titulo = String(pick(entry, TITLE_KEYS) ?? "").trim();
    if (!titulo) continue;
    const area = String(pick(entry, AREA_KEYS) ?? "").trim();
    const respRaw = pick(entry, RESP_KEYS);
    const responsabilidades = Array.isArray(respRaw)
      ? respRaw.map((s) => String(s).trim()).filter(Boolean)
      : typeof respRaw === "string"
        ? splitList(respRaw)
        : [];
    const explicitParent = pick(entry, PARENT_KEYS);
    const reportaATitulo = explicitParent ? String(explicitParent).trim() : parentTitulo;
    acc.push({ titulo, area, responsabilidades, reportaATitulo: reportaATitulo || null });

    const childrenRaw = pick(entry, CHILDREN_KEYS);
    if (Array.isArray(childrenRaw)) {
      flattenJsonTree(childrenRaw as RawJsonEntry[], titulo, acc);
    }
  }
}

function parseJson(content: string): ImportResult {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return { nodes: [], warnings: ["O arquivo não é um JSON válido."], format: "json" };
  }

  const list: RawJsonEntry[] = Array.isArray(data)
    ? (data as RawJsonEntry[])
    : Array.isArray((data as RawJsonEntry)?.nodes)
      ? ((data as RawJsonEntry).nodes as RawJsonEntry[])
      : Array.isArray((data as RawJsonEntry)?.organograma)
        ? ((data as RawJsonEntry).organograma as RawJsonEntry[])
        : [];

  if (list.length === 0) {
    warnings.push('Nenhum cargo encontrado — o JSON deve ser uma lista, ou um objeto com a chave "nodes" ou "organograma".');
    return { nodes: [], warnings, format: "json" };
  }

  const raw: RawEntry[] = [];
  flattenJsonTree(list, null, raw);
  return resolveEntries(raw, warnings, "json");
}

// ---------- CSV ----------

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(content: string): ImportResult {
  const warnings: string[] = [];
  const lines = content.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    warnings.push("O CSV precisa de uma linha de cabeçalho e ao menos uma linha de dados.");
    return { nodes: [], warnings, format: "csv" };
  }

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter).map(normalizeKey);
  const idxTitle = header.findIndex((h) => TITLE_KEYS.includes(h));
  const idxArea = header.findIndex((h) => AREA_KEYS.includes(h));
  const idxResp = header.findIndex((h) => RESP_KEYS.includes(h));
  const idxParent = header.findIndex((h) => PARENT_KEYS.includes(h));

  if (idxTitle === -1) {
    warnings.push('O CSV precisa de uma coluna de cargo (ex.: "cargo" ou "titulo").');
    return { nodes: [], warnings, format: "csv" };
  }

  const raw: RawEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const titulo = (cols[idxTitle] ?? "").trim();
    if (!titulo) continue;
    const area = idxArea >= 0 ? (cols[idxArea] ?? "").trim() : "";
    const respCell = idxResp >= 0 ? (cols[idxResp] ?? "").trim() : "";
    const parentCell = idxParent >= 0 ? (cols[idxParent] ?? "").trim() : "";
    raw.push({
      titulo,
      area,
      responsabilidades: respCell ? splitList(respCell) : [],
      reportaATitulo: parentCell || null,
    });
  }

  return resolveEntries(raw, warnings, "csv");
}

// ---------- Texto livre / markdown / PDF extraído ----------

/** Divide `line` no primeiro `char` que está fora de parênteses (profundidade 0). */
function splitAtTopLevel(line: string, char: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === char && depth === 0) return [line.slice(0, i), line.slice(i + 1)];
  }
  return null;
}

/**
 * Analisa uma linha no formato "Cargo (Área): resp1; resp2". Cargos em
 * português usam parênteses no próprio título (ex.: "Secretário(a)"), então
 * a "área" só é reconhecida no ÚLTIMO grupo entre parênteses, e apenas
 * quando não sobra texto depois dele — evita confundir "(a)" com a área.
 */
function parseOrgLine(rest: string): { titulo: string; area: string; responsabilidades: string[] } {
  const colonSplit = splitAtTopLevel(rest, ":");
  const head = colonSplit ? colonSplit[0] : rest;
  const respRaw = colonSplit ? colonSplit[1].trim() : "";

  const groups: { start: number; end: number; content: string }[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (head[i] === ")") {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && start >= 0) {
        groups.push({ start, end: i, content: head.slice(start + 1, i) });
        start = -1;
      }
    }
  }

  let titulo = head.trim();
  let area = "";
  if (groups.length > 0) {
    const last = groups[groups.length - 1];
    if (head.slice(last.end + 1).trim() === "") {
      area = last.content.trim();
      titulo = head.slice(0, last.start).trim();
    }
  }

  return {
    titulo: titulo || head.trim(),
    area,
    responsabilidades: respRaw ? splitList(respRaw) : [],
  };
}

function parseText(content: string): ImportResult {
  const warnings: string[] = [];
  const rawLines = content.split(/\r\n|\n|\r/);
  const entries: (RawEntry & { depth: number })[] = [];

  for (const line of rawLines) {
    if (!line.trim()) continue;
    const leading = line.match(/^[ \t]*/)?.[0] ?? "";
    const tabs = (leading.match(/\t/g) ?? []).length;
    const spaces = leading.replace(/\t/g, "").length;
    const depth = tabs + Math.floor(spaces / 2);

    let rest = line.slice(leading.length);
    rest = rest.replace(/^(?:[-*•]|\d+[.)])\s+/, "");
    if (!rest.trim()) continue;

    const { titulo, area, responsabilidades } = parseOrgLine(rest);
    if (!titulo) continue;

    entries.push({ titulo, area, responsabilidades, reportaATitulo: null, depth });
  }

  if (entries.length === 0) {
    warnings.push("Nenhuma linha reconhecível foi encontrada no texto.");
    return { nodes: [], warnings, format: "texto" };
  }

  const maxDepth = Math.max(...entries.map((e) => e.depth));
  const stack: (string | null)[] = [];
  for (const e of entries) {
    stack[e.depth] = e.titulo;
    stack.length = e.depth + 1;
    e.reportaATitulo = e.depth > 0 ? stack[e.depth - 1] ?? null : null;
  }

  if (maxDepth === 0) {
    warnings.push(
      'Não detectei indentação/hierarquia no texto — todos os cargos foram colocados no topo; ajuste manualmente o campo "Reporta-se a" de cada um.',
    );
  }

  const avgLen = entries.reduce((s, e) => s + e.titulo.length, 0) / entries.length;
  if (entries.length > 60 || avgLen < 4) {
    warnings.push(
      `O texto extraído parece fragmentado (comum em organogramas em formato de caixas/gráficos dentro de PDF) — ${entries.length} possível(is) cargo(s) detectado(s). Revise com cuidado ou prefira preencher manualmente.`,
    );
  }

  return resolveEntries(entries, warnings, "texto");
}

// ---------- Dispatch ----------

/** Analisa um arquivo pelo nome real (json/csv/txt/md). PDFs são extraídos antes, via parseOrgText. */
export function parseOrgFile(filename: string, content: string): ImportResult {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return parseJson(content);
  if (ext === "csv") return parseCsv(content);
  return parseText(content);
}

/** Força o parser heurístico de texto — usado para conteúdo extraído de PDF. */
export function parseOrgText(content: string): ImportResult {
  return parseText(content);
}

/** Detecta o formato de um conteúdo colado (sem nome de arquivo real). */
export function parseOrgPasted(content: string): ImportResult {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return parseJson(trimmed);
    } catch {
      // não é JSON válido — cai para os outros formatos
    }
  }
  const firstLine = trimmed.split(/\r\n|\n|\r/)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  if (commaCount >= 2 || semiCount >= 2) {
    const delimiter = semiCount > commaCount ? ";" : ",";
    const header = firstLine.split(delimiter).map(normalizeKey);
    if (header.some((h) => TITLE_KEYS.includes(h))) {
      return parseCsv(trimmed);
    }
  }
  return parseText(trimmed);
}
