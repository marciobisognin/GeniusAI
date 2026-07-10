import type { AgentDecision, AgentRunner, DecideInput } from "./AgentRunner";

interface SnapshotLike {
  you?: {
    id?: string;
    researching?: string | null;
    tech?: string[];
    resources?: { food?: number; gold?: number; science?: number };
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
 * Estratégia fixa: se não há pesquisa em andamento, pesquisa a primeira
 * tecnologia do catálogo cujos pré-requisitos já foram atendidos; caso
 * contrário, aguarda (nenhuma ação).
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
    if (you && !you.researching) {
      const next = techs.find((t) => !known.has(t.name) && t.requires.every((r) => known.has(r)));
      decision = next
        ? {
            reasoning: `(mock) Iniciando pesquisa de ${next.name} para manter o avanço tecnológico.`,
            actions: [{ tool: "research", args: { technology: next.name } }],
          }
        : { reasoning: "(mock) Catálogo esgotado; consolidando o que temos.", actions: [] };
    } else {
      decision = { reasoning: "(mock) Pesquisa em andamento; aguardando o próximo ciclo.", actions: [] };
    }

    // Exercita o caminho de streaming da UI, como um runner real faria.
    input.onToken?.(JSON.stringify(decision));
    return decision;
  }
}
