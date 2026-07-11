import type { AgentDecision, AgentRunner, DecideInput } from "./AgentRunner";

interface SnapshotLike {
  you?: {
    id?: string;
    researching?: string | null;
    tech?: string[];
    resources?: { food?: number; gold?: number; science?: number };
  };
  others?: Array<{ id: string; alive: boolean; stanceToYou?: string }>;
  proposals?: {
    incoming?: Array<{ id: string; kind: string; from: string }>;
    outgoing?: Array<{ id: string }>;
  };
  catalog?: { techs?: Array<{ name: string; cost: number; requires: string[] }> };
}

/** Extrai o snapshot embutido no prompt do turno (primeira linha JSON-objeto). */
function extractSnapshot(user: string): SnapshotLike | null {
  for (const line of user.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      return JSON.parse(trimmed) as SnapshotLike;
    } catch {
      // linha não era o snapshot — segue procurando
    }
  }
  return null;
}

/**
 * Runner simulado (RUNNER=mock): decisões determinísticas sem nenhum modelo
 * externo. Serve para desenvolvimento da UI, testes e smoke tests — o motor,
 * o orquestrador, a persistência e o streaming funcionam de ponta a ponta.
 *
 * Estratégia fixa, em ordem de prioridade:
 * 1. responde (aceitando) a primeira proposta bilateral recebida;
 * 2. se não há pesquisa em andamento, pesquisa a primeira tecnologia do
 *    catálogo cujos pré-requisitos já foram atendidos;
 * 3. com ouro sobrando e nenhuma proposta sua pendente, propõe um comércio
 *    modesto ao primeiro vizinho vivo (exercita o fluxo bilateral);
 * 4. caso contrário, aguarda (nenhuma ação).
 */
export class MockRunner implements AgentRunner {
  readonly name = "mock";

  async healthy(): Promise<boolean> {
    return true;
  }

  async decide(input: DecideInput): Promise<AgentDecision> {
    const snapshot = extractSnapshot(input.user);
    const you = snapshot?.you;
    const techs = snapshot?.catalog?.techs ?? [];
    const known = new Set(you?.tech ?? []);

    let decision: AgentDecision;
    const incoming = snapshot?.proposals?.incoming ?? [];
    if (incoming.length > 0) {
      const p = incoming[0];
      decision = {
        reasoning: `(mock) Aceitando a proposta de ${p.kind} vinda de ${p.from} — cooperação determinística.`,
        actions: [{ tool: "respond_proposal", args: { proposalId: p.id, accept: true } }],
      };
    } else if (you && !you.researching) {
      const next = techs.find((t) => !known.has(t.name) && t.requires.every((r) => known.has(r)));
      decision = next
        ? {
            reasoning: `(mock) Iniciando pesquisa de ${next.name} para manter o avanço tecnológico.`,
            actions: [{ tool: "research", args: { technology: next.name } }],
          }
        : { reasoning: "(mock) Catálogo esgotado; consolidando o que temos.", actions: [] };
    } else {
      const partner = snapshot?.others?.find((o) => o.alive && o.stanceToYou !== "war");
      const gold = you?.resources?.gold ?? 0;
      const outgoing = snapshot?.proposals?.outgoing ?? [];
      if (partner && gold >= 25 && outgoing.length === 0) {
        decision = {
          reasoning: `(mock) Propondo comércio a ${partner.id}: 5 de ouro por 5 de alimento.`,
          actions: [{ tool: "propose_trade", args: { civ: partner.id, offer: { gold: 5 }, request: { food: 5 } } }],
        };
      } else {
        decision = { reasoning: "(mock) Pesquisa em andamento; aguardando o próximo ciclo.", actions: [] };
      }
    }

    // Exercita o caminho de streaming da UI, como um runner real faria.
    input.onToken?.(JSON.stringify(decision));
    return decision;
  }
}
