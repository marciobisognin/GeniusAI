import { spawn } from "node:child_process";
import type { AgentDecision, AgentRunner, DecideInput } from "./AgentRunner";
import { parseDecision } from "./parse";

export interface CliAgentOptions {
  name: string;
  /** Binário do CLI (ex.: "claude", "codex", "opencode"). */
  cmd: string;
  /** Argumentos para o modo de decisão (headless). */
  decideArgs: string[];
  /** Argumentos para o health check (padrão: ["--version"]). */
  healthArgs?: string[];
  /** Enviar o prompt via stdin (padrão) ou anexado como último argumento. */
  promptOnStdin?: boolean;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(
  cmd: string,
  args: string[],
  stdin: string | undefined,
  timeoutMs: number,
  onToken?: (chunk: string) => void,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timeout após ${timeoutMs}ms: ${cmd}`));
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      onToken?.(s);
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });

    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function buildPrompt(input: DecideInput): string {
  return [
    input.system,
    "",
    input.user,
    "",
    "Responda ESTRITAMENTE com um único objeto JSON aderente a este JSON Schema.",
    "Não inclua texto fora do JSON, nem cercas de código (```).",
    JSON.stringify(input.schema),
  ].join("\n");
}

/**
 * Runner que aciona um CLI de agente de codificação em modo headless
 * (Claude Code, Codex, opencode, ...) como subprocesso.
 */
export class CliAgentRunner implements AgentRunner {
  readonly name: string;

  constructor(private readonly opts: CliAgentOptions) {
    this.name = opts.name;
  }

  async healthy(): Promise<boolean> {
    const args = this.opts.healthArgs ?? ["--version"];
    try {
      const { code } = await run(this.opts.cmd, args, undefined, 10_000);
      return code === 0;
    } catch {
      return false;
    }
  }

  async decide(input: DecideInput): Promise<AgentDecision> {
    const prompt = buildPrompt(input);
    const useStdin = this.opts.promptOnStdin ?? true;
    const args = useStdin
      ? this.opts.decideArgs
      : [...this.opts.decideArgs, prompt];

    const { stdout, code, stderr } = await run(
      this.opts.cmd,
      args,
      useStdin ? prompt : undefined,
      input.timeoutMs ?? 60_000,
      input.onToken,
    );
    if (code !== 0 && stdout.trim() === "") {
      throw new Error(`${this.opts.cmd} saiu com código ${code}: ${stderr.slice(0, 300)}`);
    }
    return parseDecision(stdout);
  }
}
