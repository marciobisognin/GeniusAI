import { spawn } from "node:child_process";
import type { CompletionInput, CompletionOutput, LLMProviderAdapter } from "./adapter.js";

export interface OpenAICodexAdapterOptions {
  /** Binário do CLI (padrão: "codex"). */
  cmd?: string;
  /** Argumentos para o modo de completude (o prompt vai por stdin). */
  completeArgs?: string[];
  /** Argumentos para o health check (padrão: ["--version"]). */
  healthArgs?: string[];
}

function runProcess(cmd: string, args: string[], stdin?: string, timeoutMs = 15_000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`OpenAICodexAdapter: timeout após ${timeoutMs}ms executando "${cmd} ${args.join(" ")}"`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

/**
 * Wrapper de CLI de código (Codex ou equivalente) — mesmo padrão de spawn de
 * `geniusai-civilizations/apps/backend/src/agent/CliAgentRunner.ts`
 * (stdin para o prompt, stdout para a resposta), generalizado para o
 * contrato neutro `LLMProviderAdapter`.
 */
export class OpenAICodexAdapter implements LLMProviderAdapter {
  readonly name = "openai-codex";
  private readonly cmd: string;
  private readonly completeArgs: string[];
  private readonly healthArgs: string[];

  constructor(options: OpenAICodexAdapterOptions = {}) {
    this.cmd = options.cmd ?? "codex";
    this.completeArgs = options.completeArgs ?? ["exec"];
    this.healthArgs = options.healthArgs ?? ["--version"];
  }

  async healthy(): Promise<boolean> {
    try {
      const { code } = await runProcess(this.cmd, this.healthArgs, undefined, 5_000);
      return code === 0;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const promptWithSystem = input.system ? `${input.system}\n\n${input.prompt}` : input.prompt;
    const { code, stdout, stderr } = await runProcess(
      this.cmd,
      this.completeArgs,
      promptWithSystem,
      input.timeoutMs ?? 60_000,
    );
    if (code !== 0) {
      throw new Error(`OpenAICodexAdapter: código de saída ${code}: ${stderr}`);
    }
    return { text: stdout.trim(), raw: { stdout, stderr, code } };
  }
}
