/**
 * Contrato único de execução de modelo — generalização do `AgentRunner` que
 * já existe em `geniusai-civilizations/apps/backend/src/agent/AgentRunner.ts`
 * (lá especializado em "decidir o turno de uma civilização"; aqui, neutro:
 * completar um prompt). Nenhuma parte do sistema deve falar diretamente com
 * a API de um provedor — só com esta interface, para poder trocar de
 * provedor por configuração.
 */
export interface CompletionInput {
  /** Prompt de sistema (persona, instruções estáveis). */
  system?: string;
  /** Prompt do usuário/tarefa. */
  prompt: string;
  /** Override do modelo para esta chamada (senão usa o padrão do adapter). */
  model?: string;
  maxTokens?: number;
  /** Streaming de tokens, quando o adapter suportar. */
  onToken?: (chunk: string) => void;
  /** Timeout em ms (padrão: 10s). */
  timeoutMs?: number;
}

export interface CompletionOutput {
  text: string;
  /** Resposta bruta do provedor, para debug/trace. */
  raw?: unknown;
}

export interface LLMProviderAdapter {
  readonly name: string;
  /** Verifica credenciais/conectividade sem depender de o chamador saber o protocolo. */
  healthy(): Promise<boolean>;
  complete(input: CompletionInput): Promise<CompletionOutput>;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export function timeoutSignal(ms: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
