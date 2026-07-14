import { z } from "zod";
import { ADVISOR_ROLES } from "@geniusai/shared";
import type { AdvisorRecommendation, AdvisorRole } from "@geniusai/shared";
import type { CivId, World } from "../engine/types";
import { RESPONSE_JSON_SCHEMA } from "./actions";
import type { AgentRunner } from "./AgentRunner";
import { MAX_PUBLIC_REASONING_CHARS, clampPublicReasoning } from "./runTurn";
import { snapshotForCiv } from "./prompt";

/**
 * Conselheiros especialistas (PRD §16, Fase 14 — RF-9): cada um roda UMA
 * chamada curta ao MESMO runner/modelo da civilização (nunca um segundo
 * provedor) antes da decisão do agente principal, recebendo apenas o
 * recorte do snapshot relevante à sua especialidade.
 */

export const ADVISOR_LABEL: Record<AdvisorRole, string> = {
  economic: "Conselheiro Econômico",
  diplomatic: "Conselheiro Diplomático",
  military: "Conselheiro Militar",
  scientific: "Conselheiro Científico",
  historian: "Historiador da Corte",
};

const ADVISOR_FOCUS: Record<AdvisorRole, string> = {
  economic: "recursos, comércio e crescimento econômico das cidades",
  diplomatic: "relações com as demais civilizações e propostas pendentes",
  military: "exércitos, ameaças e oportunidades de guerra",
  scientific: "pesquisa em andamento e o catálogo de tecnologias disponíveis",
  historian: "o histórico recente da civilização e padrões de longo prazo",
};

/** Timeout padrão de UM conselheiro — deliberadamente curto (RNF §16.4). */
export const DEFAULT_ADVISOR_TIMEOUT_MS = 20_000;

const AdvisorRecommendationSchema = z.object({
  role: z.enum(ADVISOR_ROLES),
  recommendation: z.string().trim().min(1).max(280),
  confidence: z.enum(["low", "medium", "high"]),
});

/**
 * Recorte do snapshot relevante a cada especialidade — o conselheiro militar
 * não recebe detalhes de pesquisa, o científico não recebe posições de
 * exército, etc. (RF-9). `historian` é o único que recebe o snapshot
 * completo (seu papel é justamente cruzar todas as frentes).
 */
function snapshotForAdvisor(world: World, civId: CivId, role: AdvisorRole): unknown {
  const full = snapshotForCiv(world, civId);
  switch (role) {
    case "military":
      return {
        tick: full.tick,
        you: { id: full.you.id, resources: { gold: full.you.resources.gold }, armies: full.you.armies, cities: full.you.cities },
        others: full.others.map((o) => ({ id: o.id, alive: o.alive, stanceToYou: o.stanceToYou, armies: o.armies })),
      };
    case "scientific":
      return {
        tick: full.tick,
        you: { id: full.you.id, tech: full.you.tech, researching: full.you.researching, resources: { science: full.you.resources.science } },
        catalog: { techs: full.catalog.techs },
      };
    case "economic":
      return {
        tick: full.tick,
        you: { id: full.you.id, resources: full.you.resources, cities: full.you.cities },
        proposals: full.proposals,
        catalog: { structures: full.catalog.structures },
      };
    case "diplomatic":
      return {
        tick: full.tick,
        you: { id: full.you.id },
        others: full.others.map((o) => ({ id: o.id, alive: o.alive, stanceToYou: o.stanceToYou })),
        proposals: full.proposals,
      };
    case "historian":
      return full;
  }
}

function buildAdvisorSystemPrompt(persona: string, civId: CivId, role: AdvisorRole): string {
  return [
    `Você é o(a) "${ADVISOR_LABEL[role]}" da corte da civilização "${civId}" — NÃO é quem decide.`,
    `Personalidade da civilização que você serve: ${persona}`,
    `Seu foco é apenas: ${ADVISOR_FOCUS[role]}. Ignore o resto do estado do mundo.`,
    `Dê UMA recomendação curta e acionável (no máximo ${MAX_PUBLIC_REASONING_CHARS} caracteres) ao governante,`,
    `que decide livremente se vai segui-la ou não.`,
    `Responda ESTRITAMENTE com um único objeto JSON: { "reasoning": string, "actions": [] }.`,
    `Em "reasoning", comece com seu nível de confiança entre colchetes — "[low]", "[medium]" ou "[high]" —`,
    `seguido de ":" e da recomendação. Exemplo: "[high]: recrute mais um exército antes de atacar."`,
    `Nunca proponha ações em "actions" (deixe sempre []) — você só aconselha.`,
  ].join("\n");
}

function buildAdvisorUserPrompt(world: World, civId: CivId, role: AdvisorRole): string {
  return [
    `Recorte do estado do mundo relevante à sua especialidade (tick ${world.tick}):`,
    JSON.stringify(snapshotForAdvisor(world, civId, role)),
    ``,
    `Dê sua recomendação agora.`,
  ].join("\n");
}

const CONFIDENCE_PREFIX_RE = /^\s*\[?(low|medium|high)\]?\s*[:-]\s*(.+)$/is;

/**
 * Deriva uma `AdvisorRecommendation` da resposta bruta do runner. O runner
 * ainda fala o mesmo contrato `{reasoning, actions}` de sempre (nenhuma
 * mudança na interface `AgentRunner`) — a confiança vem de um prefixo
 * convencionado ("[high]: ...") no `reasoning`; se o runner não seguir o
 * formato, cai para confiança "medium" em vez de falhar (mesmo espírito de
 * robustez do RF-3 — nunca travar por causa de um modelo imperfeito).
 */
function parseAdvisorRecommendation(role: AdvisorRole, rawReasoning: string): AdvisorRecommendation | null {
  const text = rawReasoning.trim();
  if (!text) return null;

  const match = CONFIDENCE_PREFIX_RE.exec(text);
  const confidence = match ? (match[1].toLowerCase() as AdvisorRecommendation["confidence"]) : "medium";
  const recommendation = clampPublicReasoning((match ? match[2] : text).trim()).slice(0, 280);

  const parsed = AdvisorRecommendationSchema.safeParse({ role, recommendation, confidence });
  return parsed.success ? parsed.data : null;
}

/**
 * Consulta UM conselheiro. Nunca lança — falha (timeout, JSON inválido,
 * exceção do runner) vira `null`, e a chamada é simplesmente descartada
 * (RF-9: "se o conselheiro falhar/retornar JSON inválido, sua recomendação
 * é descartada — nunca bloqueia o turno").
 */
export async function consultAdvisor(
  world: World,
  civId: CivId,
  role: AdvisorRole,
  runner: AgentRunner,
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<AdvisorRecommendation | null> {
  const persona = world.civilizations[civId].persona;
  try {
    const decision = await runner.decide({
      system: buildAdvisorSystemPrompt(persona, civId, role),
      user: buildAdvisorUserPrompt(world, civId, role),
      schema: RESPONSE_JSON_SCHEMA,
      timeoutMs: opts.timeoutMs ?? DEFAULT_ADVISOR_TIMEOUT_MS,
      model: opts.model,
    });
    return parseAdvisorRecommendation(role, decision.reasoning);
  } catch {
    return null;
  }
}

/**
 * Consulta todos os conselheiros ativos EM PARALELO (chamadas independentes,
 * mesmo runner) e devolve só as recomendações que deram certo, na mesma
 * ordem de `roles` — nunca lança, nunca bloqueia o turno principal por causa
 * de um conselheiro lento/instável.
 */
export async function consultAdvisors(
  world: World,
  civId: CivId,
  roles: AdvisorRole[],
  runner: AgentRunner,
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<AdvisorRecommendation[]> {
  const uniqueRoles = [...new Set(roles)];
  const settled = await Promise.all(uniqueRoles.map((role) => consultAdvisor(world, civId, role, runner, opts)));
  return settled.filter((r): r is AdvisorRecommendation => r !== null);
}
