import { Agent } from "@genius/canon";
import { extractExportedLiteral } from "./literalExtractor.js";

/** Formato bruto de `DEFAULT_CIVILIZATIONS` em `geniusai-civilizations/packages/shared/src/index.ts`. */
interface RawCivilizationDefinition {
  id: string;
  name: string;
  adjective: string;
  leaderName: string;
  personality: string[];
  priorities: string[];
  riskTolerance: number;
  diplomacyStyle: string;
  model?: string;
}

/**
 * Converte as definições de civilização (`DEFAULT_CIVILIZATIONS`) em agentes
 * do canon — cada civilização é, na prática, o perfil de um líder digital:
 * personalidade, prioridades estratégicas e postura diplomática já
 * estruturadas. Puro: lê a AST de `packages/shared/src/index.ts`, não
 * executa o arquivo (que depende de `@geniusai/shared` internamente).
 */
export function importCivilizationsProfiles(
  sourceText: string,
  sourcePath = "geniusai-civilizations/packages/shared/src/index.ts",
): Agent[] {
  const raw = extractExportedLiteral(sourceText, "DEFAULT_CIVILIZATIONS") as Record<
    string,
    RawCivilizationDefinition
  >;

  return Object.values(raw).map((def) =>
    Agent.parse({
      id: def.id,
      nome: def.leaderName,
      area: def.name,
      descricao: `Líder ${def.adjective} — personalidade: ${def.personality.join(", ")}. Prioriza: ${def.priorities.join(", ")}. Estilo diplomático: ${def.diplomacyStyle} (tolerância a risco ${def.riskTolerance}).`,
      skills: def.priorities,
      modelPolicy: def.model ? { default: def.model } : undefined,
      origem: "importado",
      origemDetalhe: sourcePath,
    }),
  );
}
