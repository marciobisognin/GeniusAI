/**
 * Contrato de execução dos agentes. A camada de simulação nunca fala
 * diretamente com um CLI/back-end de LLM — só com esta interface, o que
 * permite trocar de runner (Claude Code / Codex / opencode / Ollama) por
 * configuração, sem tocar no resto do sistema.
 */

export interface AgentAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface AgentDecision {
  /** Justificativa legível (exibida na UI — a essência do "watchable AI"). */
  reasoning: string;
  /** Ações escolhidas neste turno (validadas depois pelo World Engine). */
  actions: AgentAction[];
  /** Saída bruta do runner, para debug/trace. */
  raw?: string;
}

export interface DecideInput {
  /** Prompt estável: regras + descrição das ações + persona da civilização. */
  system: string;
  /** Prompt volátil do turno: snapshot do mundo, estado próprio, memória. */
  user: string;
  /** JSON Schema das ações — o runner deve produzir JSON aderente a ele. */
  schema: object;
  /** Callback para streaming de tokens/saída (raciocínio ao vivo). */
  onToken?: (chunk: string) => void;
  /** Timeout do turno (ms). */
  timeoutMs?: number;
}

export interface AgentRunner {
  readonly name: string;
  /** O runner configurado está disponível/responde? (health check). */
  healthy(): Promise<boolean>;
  /** Produz a decisão de um turno para uma civilização. */
  decide(input: DecideInput): Promise<AgentDecision>;
}
