import { createWorld, tick } from "../engine/index.js";
import { coerceActions } from "../agent/actions.js";
import type { CivDecision, CivId, GameEvent, World } from "@geniusai/shared";

/**
 * Sala de Ensaio — a **Lei 2** do Allspark ("nenhuma missão sem ensaio")
 * apoiada no motor determinístico deste projeto.
 *
 * O que o motor entrega e que nada mais no repositório entrega: dado um
 * `seed` e um conjunto de decisões, o mundo seguinte é **sempre o mesmo**
 * (`createWorld` determinístico, `tick` puro, PRNG com estado serializável).
 * Isso permite responder "o que acontece se…" com consequências observáveis e
 * reproduzíveis, antes de a decisão valer no mundo real.
 *
 * Limite honesto, e ele importa: o domínio simulado é o **de civilizações**
 * (cidades, exércitos, tecnologia, diplomacia), não decisões institucionais
 * genéricas. Generalizar o motor é redesenho de produto, não porte — ver
 * `docs/ANALISE-PLUGINS-HERMES.md` §3.7. O que existe aqui é o ensaio real que
 * o motor já suporta, exposto por uma fronteira estável.
 */

export const MAX_TICKS = 40;

export interface RehearsalPlan {
  /** Decisões por civilização, repetidas a cada tick do ensaio. */
  civ: CivId;
  /** Ações no formato do motor; passam pela mesma validação dos agentes. */
  actions: unknown[];
}

export interface RehearsalInput {
  seed: number;
  ticks: number;
  plans?: RehearsalPlan[];
}

export interface RehearsalOutcome {
  seed: number;
  ticks: number;
  /** Assinatura determinística: mesmo ensaio → mesma assinatura. */
  signature: string;
  finalTick: number;
  victory: World["victory"];
  civilizations: Array<{
    id: CivId;
    persona: string;
    viva: boolean;
    cidades: number;
    exercitos: number;
    tecnologias: number;
    recursos: Record<string, number>;
  }>;
  /** Eventos agrupados por tipo — a consequência observável do plano. */
  eventos: Record<string, number>;
  /** Ações recusadas pelo motor, com o motivo: o ensaio também ensina o que NÃO dá. */
  recusadas: Array<{ tick: number; detalhe: string }>;
  /** Ações que nem chegaram ao motor por serem malformadas. */
  invalidas: string[];
  aviso: string;
}

const AVISO =
  "Ensaio determinístico no domínio de civilizações do GeniusAI Civilizations. " +
  "As consequências valem para este modelo, não são previsão sobre o mundo real.";

function summarize(world: World): RehearsalOutcome["civilizations"] {
  return Object.values(world.civilizations).map((civ) => ({
    id: civ.id,
    persona: civ.persona,
    viva: civ.alive,
    cidades: civ.cities.length,
    exercitos: civ.armies.length,
    tecnologias: civ.tech.length,
    recursos: { ...civ.resources },
  }));
}

/**
 * Hash estável do resultado — o mesmo papel do `model_signature` do Foresight.
 *
 * Precisa incluir o que está **em andamento**, não só o que já concluiu: uma
 * primeira versão desta função ignorava `researching` e `pendingProposals`, e
 * com isso dois mundos genuinamente diferentes (um pesquisando, outro parado)
 * assinavam igual — uma assinatura que não distingue não serve para provar
 * reprodutibilidade.
 */
function signWorld(world: World): string {
  const canonical = JSON.stringify({
    tick: world.tick,
    rngState: world.rngState,
    victory: world.victory,
    proposals: world.pendingProposals.map((proposal) => proposal.id).sort(),
    civs: Object.values(world.civilizations).map((civ) => ({
      id: civ.id,
      alive: civ.alive,
      cities: civ.cities.length,
      armies: civ.armies.length,
      techs: [...civ.tech].sort(),
      researching: civ.researching,
      resources: civ.resources,
    })),
  });
  let hash = 0n;
  for (const char of canonical) {
    hash = (hash * 131n + BigInt(char.codePointAt(0) ?? 0)) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function validateInput(input: RehearsalInput): { seed: number; ticks: number; plans: RehearsalPlan[] } {
  const { seed, ticks } = input;
  if (!Number.isInteger(seed) || seed < 0 || seed > Number.MAX_SAFE_INTEGER) {
    throw new Error("'seed' precisa ser inteiro não negativo");
  }
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > MAX_TICKS) {
    throw new Error(`'ticks' precisa ser inteiro entre 1 e ${MAX_TICKS}`);
  }
  const plans = input.plans ?? [];
  if (!Array.isArray(plans)) throw new Error("'plans' precisa ser uma lista");
  return { seed, ticks, plans };
}

/**
 * Roda o ensaio: N ticks a partir de `seed`, aplicando os planos a cada tick.
 *
 * Ações inválidas não derrubam o ensaio — viram evento `action_rejected`, que
 * é justamente o retorno mais útil de um ensaio: descobrir que o plano não é
 * executável *antes* de tentar valendo.
 */
export function rehearse(input: RehearsalInput): RehearsalOutcome {
  const { seed, ticks, plans } = validateInput(input);

  let world = createWorld(seed);
  const eventos: Record<string, number> = {};
  const recusadas: RehearsalOutcome["recusadas"] = [];

  // Mesma validação que os agentes reais sofrem: o ensaio não pode aceitar uma
  // ação que a execução recusaria. Ação malformada não derruba o ensaio — vira
  // aviso, que já é resposta útil sobre o plano.
  const invalidas: string[] = [];
  const decisions: CivDecision[] = plans.map((plan) => {
    const { valid, errors } = coerceActions(plan.actions);
    invalidas.push(...errors.map((error) => `${plan.civ}: ${error}`));
    return { civ: plan.civ, actions: valid };
  });

  for (let step = 0; step < ticks; step += 1) {
    if (world.victory) break;
    world = tick(world, decisions);
    for (const event of (world.events ?? []) as GameEvent[]) {
      eventos[event.type] = (eventos[event.type] ?? 0) + 1;
      if (event.type === "action_rejected") {
        recusadas.push({ tick: world.tick, detalhe: JSON.stringify(event) });
      }
    }
  }

  return {
    seed,
    ticks,
    signature: signWorld(world),
    finalTick: world.tick,
    victory: world.victory,
    civilizations: summarize(world),
    eventos,
    recusadas: recusadas.slice(0, 20),
    invalidas: invalidas.slice(0, 20),
    aviso: AVISO,
  };
}

/** Verifica que o mesmo ensaio continua reproduzível — a prova do determinismo. */
export function verifyDeterminism(input: RehearsalInput, expectedSignature: string): {
  status: "match" | "mismatch";
  expected: string;
  actual: string;
} {
  const actual = rehearse(input).signature;
  return {
    status: actual === expectedSignature ? "match" : "mismatch",
    expected: expectedSignature,
    actual,
  };
}
