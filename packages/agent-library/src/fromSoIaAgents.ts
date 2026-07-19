import { Agent, Squad } from "@genius/canon";
import { extractExportedLiteral } from "./literalExtractor.js";

/** Formato bruto de `so-ia/src/lib/data/types.ts` — só os campos que este importador lê. */
interface RawSoIaAgent {
  id: string;
  nome: string;
  area: string;
  autonomia: string;
  descricao: string;
  skills: string[];
  connectors: string[];
  modelPolicy: { default: string; sensitive?: string };
}

interface RawSoIaSquadTemplate {
  id: string;
  nome: string;
  area: string;
  descricao: string;
  desempenho: number;
  origem: "institucional" | "criado";
}

/**
 * Lê `so-ia/src/lib/data/agents.ts` (conteúdo do arquivo, não o caminho) e
 * devolve os agentes de `agentsEmpresa` e `agentsGoverno` já validados pelo
 * canon. Não executa o arquivo — só lê sua AST (ver `literalExtractor.ts`),
 * então não precisa resolver `import type { Agent } from "./types"`.
 */
export function importSoIaAgents(sourceText: string, sourcePath = "so-ia/src/lib/data/agents.ts"): Agent[] {
  const empresa = extractExportedLiteral(sourceText, "agentsEmpresa") as RawSoIaAgent[];
  const governo = extractExportedLiteral(sourceText, "agentsGoverno") as RawSoIaAgent[];

  return [...empresa, ...governo].map((raw) =>
    Agent.parse({
      id: raw.id,
      nome: raw.nome,
      area: raw.area,
      descricao: raw.descricao,
      skills: raw.skills,
      connectors: raw.connectors,
      modelPolicy: { default: raw.modelPolicy.default, fallback: raw.modelPolicy.sensitive },
      autonomia: raw.autonomia,
      origem: "importado",
      origemDetalhe: sourcePath,
    }),
  );
}

/**
 * Lê `so-ia/src/lib/org/squad-registry.ts` e devolve `institutionalSquads`
 * (o squad meta "tpl-fundacao" incluído) já validados pelo canon.
 */
export function importSoIaSquads(
  sourceText: string,
  sourcePath = "so-ia/src/lib/org/squad-registry.ts",
): Squad[] {
  const raw = extractExportedLiteral(sourceText, "institutionalSquads") as RawSoIaSquadTemplate[];
  return raw.map((tpl) =>
    Squad.parse({
      id: tpl.id,
      nome: tpl.nome,
      area: tpl.area,
      descricao: tpl.descricao,
      desempenho: tpl.desempenho,
      origem: "importado",
      origemDetalhe: sourcePath,
      agentIds: [],
    }),
  );
}
