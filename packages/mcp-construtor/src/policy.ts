/**
 * A superfície assimétrica do Super Construtor.
 *
 * O PRD (§3.4) é explícito: o runtime de execução *"nunca decide política,
 * orçamento ou aprovação — apenas executa"*. Um servidor MCP que espelhasse a
 * API do Construtor inteira entregaria ao agente o poder de **aprovar o
 * próprio trabalho** (`POST /approvals/:id/resolve`) e de **escrever
 * credenciais** (`POST /providers`). Isso inverteria a quarta lei do produto —
 * autonomia se conquista, não se configura.
 *
 * Por isso a superfície é recortada aqui, num módulo próprio, com teste que
 * falha se alguém alargá-la sem perceber.
 */

/** Entidades que o agente pode ler. `providers` fica de fora: guarda credenciais. */
export const READABLE_ENTITIES = [
  "agents",
  "squads",
  "companies",
  "mind-clones",
  "tasks",
  "runs",
  "approvals",
  "learning-flows",
  "canvas-nodes",
  "canvas-edges",
] as const;

export type ReadableEntity = (typeof READABLE_ENTITIES)[number];

/**
 * Rotas que **nunca** podem ser alcançadas por este servidor, nem por
 * composição de ferramentas. A lista é verificada em teste.
 */
export const FORBIDDEN_ROUTES = [
  "POST /approvals/:id/resolve", // o executor não aprova o próprio trabalho
  "POST /providers", // escrita de credencial de provedor
  "DELETE /providers/:id",
  "POST /providers/:id/health-check", // toca credencial para valer
  "POST /library/import", // muda o catálogo institucional
  "POST /packs/import", // idem
  "POST /companies/:id/import-pack",
] as const;

/** Níveis de autonomia que exigem aprovação humana e, portanto, não executam por MCP. */
export const AUTONOMY_REQUIRING_APPROVAL = ["A0", "A1", "A2"] as const;

/** Os únicos níveis que dispensam aprovação. */
export const AUTONOMY_SELF_EXECUTING = ["A3", "A4", "A5"] as const;

export type Autonomy = "A0" | "A1" | "A2" | "A3" | "A4" | "A5";

/**
 * Lista de **permissão**, não de bloqueio, e a diferença importa: um valor
 * inesperado (vazio, nulo, autonomia nova que ainda não existia) precisa cair
 * do lado seguro — exigindo aprovação — em vez de escapar do portão por não
 * estar na lista de bloqueio.
 */
export function requiresHumanApproval(autonomy: string | undefined): boolean {
  return !(AUTONOMY_SELF_EXECUTING as readonly string[]).includes(autonomy ?? "");
}

export interface ExecutionDecision {
  permitido: boolean;
  motivo: string;
  autonomia?: string;
}

/**
 * Decide se um nó do canvas pode ser executado por este servidor.
 *
 * A regra não é "o agente é confiável?", é "este agente já conquistou
 * autonomia?". A0–A2 sempre pausam para um humano — e como o servidor MCP não
 * pode resolver aprovação, executá-los aqui só produziria run travado.
 */
export function decideExecution(input: {
  kind: string;
  autonomias: string[];
}): ExecutionDecision {
  if (input.kind !== "agent" && input.kind !== "squad") {
    return { permitido: false, motivo: "só nós de agente ou squad são executáveis" };
  }
  if (input.autonomias.length === 0) {
    return { permitido: false, motivo: "não foi possível determinar a autonomia — na dúvida, não executa" };
  }
  const bloqueada = input.autonomias.find((autonomia) => requiresHumanApproval(autonomia));
  if (bloqueada) {
    return {
      permitido: false,
      autonomia: bloqueada,
      motivo:
        `autonomia ${bloqueada} exige aprovação humana, e este servidor não pode resolver aprovações ` +
        "(o executor não aprova o próprio trabalho). Execute pelo Canvas, onde um humano decide.",
    };
  }
  return { permitido: true, motivo: "autonomia A3+ — execução autônoma permitida", autonomia: input.autonomias[0] };
}
