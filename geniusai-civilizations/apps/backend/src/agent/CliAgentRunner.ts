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
  /**
   * Pré-processa a saída do CLI antes de extrair o JSON de ações.
   * Ex.: `claude -p --output-format json` devolve um envelope
   * { result: "<texto do modelo>" } — o unwrap retorna o campo `result`.
   * Ignorado quando `streamJsonLines` está ativo (o "result" já vem
   * extraído do NDJSON — ver RF-18/19, Fase 19).
   */
  unwrap?: (stdout: string) => string;
  /**
   * Nome do argumento de CLI que recebe o "system" SEPARADAMENTE do prompt
   * do turno (Fase 19, §19 — RF-18). Ex.: "--system-prompt". Quando
   * definido, `input.system` nunca é concatenado no texto de stdin — evita
   * pagar (em tokens e semântica) o system prompt padrão do CLI.
   */
  systemPromptFlag?: string;
  /**
   * A saída é NDJSON — uma linha JSON por evento (Fase 19, §19 — RF-19,
   * `--output-format stream-json --include-partial-messages`). Deltas de
   * texto (`stream_event` → `content_block_delta` → `text_delta`) viram
   * `onToken` de verdade; a linha `{"type":"result", "result": "..."}` é o
   * texto final. Linha malformada/incompleta nunca derruba o turno — é só
   * ignorada (mesmo espírito de robustez do RF-3).
   */
  streamJsonLines?: boolean;
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

/** Monta o texto enviado por stdin. `includeSystem=false` quando o system vai por `systemPromptFlag` (RF-18). */
function buildPrompt(input: DecideInput, includeSystem: boolean): string {
  const parts = includeSystem ? [input.system, ""] : [];
  parts.push(
    input.user,
    "",
    "Responda ESTRITAMENTE com um único objeto JSON aderente a este JSON Schema.",
    "Não inclua texto fora do JSON, nem cercas de código (```).",
    JSON.stringify(input.schema),
  );
  return parts.join("\n");
}

/**
 * Extrai eventos de um NDJSON possivelmente fragmentado através de chamadas
 * sucessivas (stdout chega em pedaços de tamanho arbitrário — uma linha do
 * NDJSON pode atravessar duas chamadas de `data`). Devolve as linhas
 * completas encontradas e o restante ainda incompleto (para a próxima vez).
 */
function splitCompleteLines(buffer: string): { lines: string[]; rest: string } {
  const lines: string[] = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf("\n")) !== -1) {
    lines.push(rest.slice(0, idx));
    rest = rest.slice(idx + 1);
  }
  return { lines, rest };
}

interface StreamJsonEvent {
  type?: string;
  event?: { type?: string; delta?: { type?: string; text?: string } };
  result?: unknown;
}

/**
 * Cria um adaptador `onToken` que interpreta NDJSON linha a linha: repassa
 * deltas de texto reais ao `onToken` do chamador e captura a linha `result`
 * final num objeto mutável (RF-19). Nunca lança — linha malformada é
 * ignorada, exatamente como o resto do pipeline de robustez do projeto.
 */
function createStreamJsonAdapter(forwardToken?: (chunk: string) => void): {
  onChunk: (chunk: string) => void;
  getResult: () => string | null;
} {
  let buffer = "";
  let result: string | null = null;
  return {
    onChunk(chunk) {
      buffer += chunk;
      const { lines, rest } = splitCompleteLines(buffer);
      buffer = rest;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as StreamJsonEvent;
          if (obj.type === "stream_event" && obj.event?.type === "content_block_delta" && obj.event.delta?.type === "text_delta") {
            const text = obj.event.delta.text;
            if (typeof text === "string" && text) forwardToken?.(text);
          } else if (obj.type === "result" && typeof obj.result === "string") {
            result = obj.result;
          }
        } catch {
          // linha incompleta/ruído — ignora (nunca derruba o turno).
        }
      }
    },
    getResult: () => result,
  };
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
    const cliArgs = [...this.opts.decideArgs];
    if (this.opts.systemPromptFlag) {
      cliArgs.push(this.opts.systemPromptFlag, input.system);
    }
    const prompt = buildPrompt(input, !this.opts.systemPromptFlag);
    const useStdin = this.opts.promptOnStdin ?? true;
    const args = useStdin ? cliArgs : [...cliArgs, prompt];

    const streamAdapter = this.opts.streamJsonLines ? createStreamJsonAdapter(input.onToken) : null;
    const onData = streamAdapter ? streamAdapter.onChunk : input.onToken;

    const { stdout, code, stderr } = await run(
      this.opts.cmd,
      args,
      useStdin ? prompt : undefined,
      input.timeoutMs ?? 60_000,
      onData,
    );

    const streamedResult = streamAdapter?.getResult() ?? null;
    if (code !== 0 && stdout.trim() === "" && !streamedResult) {
      throw new Error(`${this.opts.cmd} saiu com código ${code}: ${stderr.slice(0, 300)}`);
    }
    const text = streamedResult ?? (this.opts.unwrap ? this.opts.unwrap(stdout) : stdout);
    return parseDecision(text);
  }
}
