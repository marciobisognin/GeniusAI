import { STRUCTURES, TECHS, getStance } from "../engine/rules";
import { CIV_IDS } from "../engine/types";
import type { CivId, GameEvent, ResourceKind, Terrain, World } from "../engine/types";
import type { AdvisorRecommendation } from "@geniusai/shared";

interface TileView {
  x: number;
  y: number;
  terrain: Terrain;
  resource: ResourceKind | null;
}

/** Visão compacta do mundo para um agente (visibilidade global no MVP). */
export function snapshotForCiv(world: World, civId: CivId) {
  const you = world.civilizations[civId];

  const tiles: TileView[] = [];
  for (const row of world.map) {
    for (const t of row) {
      if (t.owner === civId) tiles.push({ x: t.x, y: t.y, terrain: t.terrain, resource: t.resource });
    }
  }

  const others = CIV_IDS.filter((id) => id !== civId).map((id) => {
    const c = world.civilizations[id];
    return {
      id,
      alive: c.alive,
      persona: c.persona,
      stanceToYou: getStance(world, civId, id),
      cities: c.cities.map((x) => ({ x: x.x, y: x.y, population: x.population })),
      armies: c.armies.map((a) => ({ x: a.x, y: a.y, strength: a.strength })),
      techCount: c.tech.length,
    };
  });

  return {
    tick: world.tick,
    map: { width: world.width, height: world.height },
    you: {
      id: you.id,
      resources: you.resources,
      tech: you.tech,
      researching: you.researching,
      cities: you.cities,
      armies: you.armies,
      memory: you.memory,
      tiles,
    },
    others,
    proposals: {
      /** Propostas aguardando a SUA resposta (respond_proposal). */
      incoming: world.pendingProposals.filter((p) => p.to === civId),
      /** Suas propostas aguardando resposta do destinatário. */
      outgoing: world.pendingProposals.filter((p) => p.from === civId),
    },
    catalog: {
      structures: Object.entries(STRUCTURES).map(([name, s]) => ({ name, gold: s.gold })),
      techs: Object.entries(TECHS).map(([name, t]) => ({
        name,
        cost: t.cost,
        requires: t.requires,
        description: t.description,
        effects: t.effects,
      })),
    },
    victory: world.victory,
  };
}

/** Prompt de sistema (estável): regras + ações + persona. */
export function buildSystemPrompt(persona: string, civId: CivId): string {
  return [
    `Você é a IA que governa a civilização "${civId}" em uma simulação em tempo real.`,
    `Personalidade e estratégia: ${persona}`,
    ``,
    `A cada turno você recebe o estado do mundo (JSON) e escolhe de 0 a N ações.`,
    `Ações disponíveis (campos "tool" + "args"):`,
    `- build: { structure, x, y } — "city" precisa ser adjacente ao seu território; demais precisam de uma cidade sua no tile.`,
    `- research: { technology } — respeite os pré-requisitos do catálogo.`,
    `- move_army: { armyId, x, y } — destino adjacente; montanha é intransponível.`,
    `- attack: { armyId, x, y } — alvo adjacente; exige estar em guerra.`,
    `- recruit: { cityId } — recruta um exército (custa 30 de ouro; exige bronze_working E um quartel/barracks na cidade).`,
    `- set_diplomacy: { civ, stance } — stance ∈ peace | war | trade (aliança é bilateral: use propose_alliance).`,
    `- propose_trade: { civ, offer, request } — PROPÕE uma troca {food?,gold?,science?}; nada é transferido até o parceiro aceitar. Proibido em guerra.`,
    `- propose_alliance: { civ } — propõe aliança; só vale se o parceiro aceitar.`,
    `- respond_proposal: { proposalId, accept } — aceita/rejeita uma proposta em "proposals.incoming". Propostas expiram em ~3 ticks; responda-as!`,
    `- set_strategy: { note } — anota sua estratégia de longo prazo na memória.`,
    ``,
    `Responda ESTRITAMENTE com um único objeto JSON: { "reasoning": string, "actions": Action[] }.`,
    `Nada de texto fora do JSON, nada de cercas de código. "reasoning" é curto (1 a 3 frases).`,
  ].join("\n");
}

function eventConcernsCiv(event: GameEvent, civId: CivId): boolean {
  const e = event as Record<string, unknown>;
  return (
    e.civ === civId ||
    e.attacker === civId ||
    e.defender === civId ||
    e.a === civId ||
    e.b === civId ||
    e.from === civId ||
    e.to === civId ||
    e.winner === civId
  );
}

/**
 * Prompt do turno (volátil): snapshot + resultados do último turno +
 * recomendações dos conselheiros (Fase 14, §16 — quando ativos). O agente
 * principal continua livre para seguir ou ignorar o conselho.
 */
export function buildTurnPrompt(
  world: World,
  civId: CivId,
  advisorRecommendations: AdvisorRecommendation[] = [],
): string {
  const snapshot = snapshotForCiv(world, civId);
  const lastResults = world.events.filter((e) => eventConcernsCiv(e, civId));

  const advisorBlock =
    advisorRecommendations.length === 0
      ? []
      : [
          `Conselho da corte (você decide se segue ou não cada recomendação):`,
          JSON.stringify(advisorRecommendations),
          ``,
        ];

  return [
    `Estado do mundo (tick ${world.tick}):`,
    JSON.stringify(snapshot),
    ``,
    `Resultados do seu último turno:`,
    JSON.stringify(lastResults),
    ``,
    ...advisorBlock,
    `Escolha suas ações agora. Responda apenas com o JSON { "reasoning", "actions" }.`,
  ].join("\n");
}
