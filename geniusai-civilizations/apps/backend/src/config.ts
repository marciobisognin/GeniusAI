import path from "node:path";
import { REPO_ROOT } from "./paths";

export type RunnerKind = "claude" | "codex" | "opencode" | "ollama" | "mock";

export interface Config {
  runner: RunnerKind;
  /** Override do binário do CLI de agente (opcional). */
  agentCmd?: string;
  /** Modelo usado pelo runner ollama (e por CLIs que aceitem seleção). */
  model: string;
  /** Endpoint do Ollama, quando RUNNER=ollama. */
  ollamaHost: string;
  /** Endereço de bind do servidor (padrão 127.0.0.1 — produto local). */
  host: string;
  /** Porta do servidor HTTP/WebSocket do backend. */
  port: number;
  /** Liga o narrador de eventos (manchete por tick) — decorativo, off por padrão. */
  narrator: boolean;
  /**
   * Origins de browser adicionais aceitas no WebSocket (além de localhost).
   * Ex.: ALLOWED_ORIGINS=http://192.168.0.10:5173,http://meu-host:5173
   */
  allowedOrigins: string[];
}

const VALID_RUNNERS: RunnerKind[] = ["claude", "codex", "opencode", "ollama", "mock"];

/** Erro de configuração: impede a inicialização com mensagem clara. */
export class ConfigError extends Error {}

/**
 * Carrega o `.env` para process.env (se existir): primeiro o do diretório
 * atual (apps/backend), depois o da raiz do projeto — o local onde o README
 * manda criar. Variáveis já definidas no ambiente têm precedência
 * (comportamento padrão do Node); entre os dois arquivos, o primeiro vence.
 */
export function loadDotEnv(): void {
  const candidates = [path.join(process.cwd(), ".env"), path.join(REPO_ROOT, ".env")];
  for (const file of candidates) {
    try {
      process.loadEnvFile(file);
    } catch {
      // arquivo ausente — tenta o próximo
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const runnerEnv = (env.RUNNER ?? "claude").toLowerCase();
  if (!(VALID_RUNNERS as string[]).includes(runnerEnv)) {
    throw new ConfigError(
      `RUNNER inválido: "${env.RUNNER}". Valores aceitos: ${VALID_RUNNERS.join(" | ")}.`,
    );
  }

  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`PORT inválida: "${env.PORT}". Use um inteiro entre 0 e 65535.`);
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  return {
    runner: runnerEnv as RunnerKind,
    agentCmd: env.AGENT_CMD,
    model: env.MODEL ?? "qwen2.5:14b",
    ollamaHost: env.OLLAMA_HOST ?? "http://localhost:11434",
    host: env.HOST ?? "127.0.0.1",
    port,
    narrator: env.NARRATOR === "true",
    allowedOrigins,
  };
}
