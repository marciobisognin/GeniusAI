import { test } from "node:test";
import assert from "node:assert/strict";
import { CliAgentRunner } from "./CliAgentRunner";
import { RESPONSE_JSON_SCHEMA } from "./actions";

const NODE = process.execPath;

/**
 * Fixture: um "CLI" real (processo Node) que devolve, como decisão, um JSON
 * relatando o que recebeu (argv + stdin) — prova, ponta a ponta via spawn de
 * verdade (não um mock de `child_process`), que `CliAgentRunner` monta os
 * argumentos/stdin como o esperado (Fase 19, §19 — RF-18).
 */
const ECHO_ARGV_SCRIPT = `
const chunks = [];
process.stdin.on("data", (d) => chunks.push(d));
process.stdin.on("end", () => {
  const stdin = Buffer.concat(chunks).toString();
  const payload = { argv: process.argv.slice(1), stdin };
  process.stdout.write(JSON.stringify({ reasoning: JSON.stringify(payload), actions: [] }));
});
`;

/** Fixture: emite NDJSON (stream-json) com deltas de texto + linha `result` final. */
function streamJsonScript(deltas: string[], result: string): string {
  return `
const lines = ${JSON.stringify(deltas)}.map((text) =>
  JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text } } }),
);
lines.push("garbage-not-json");
lines.push(JSON.stringify({ type: "result", subtype: "success", result: ${JSON.stringify(result)} }));
process.stdout.write(lines.join("\\n") + "\\n");
`;
}

test("CliAgentRunner: com systemPromptFlag, o system vai como argumento — nunca no stdin", async () => {
  const runner = new CliAgentRunner({
    name: "fixture",
    cmd: NODE,
    // "--" faz o Node parar de interpretar as próprias flags e repassar o
    // resto (incluindo --system-prompt) para process.argv do script.
    decideArgs: ["-e", ECHO_ARGV_SCRIPT, "--"],
    systemPromptFlag: "--system-prompt",
  });
  const decision = await runner.decide({
    system: "Você é a IA de Roma.",
    user: "Estado do turno.",
    schema: RESPONSE_JSON_SCHEMA,
  });
  const payload = JSON.parse(decision.reasoning) as { argv: string[]; stdin: string };
  assert.ok(payload.argv.includes("--system-prompt"));
  assert.ok(payload.argv.includes("Você é a IA de Roma."));
  assert.ok(!payload.stdin.includes("Você é a IA de Roma."), "o system vazou para o stdin");
  assert.ok(payload.stdin.includes("Estado do turno."));
});

test("CliAgentRunner: sem systemPromptFlag (codex/opencode), o system continua concatenado no stdin", async () => {
  const runner = new CliAgentRunner({
    name: "fixture",
    cmd: NODE,
    decideArgs: ["-e", ECHO_ARGV_SCRIPT],
  });
  const decision = await runner.decide({
    system: "Você é a IA de Roma.",
    user: "Estado do turno.",
    schema: RESPONSE_JSON_SCHEMA,
  });
  const payload = JSON.parse(decision.reasoning) as { argv: string[]; stdin: string };
  assert.ok(!payload.argv.includes("--system-prompt"));
  assert.ok(payload.stdin.includes("Você é a IA de Roma."));
});

test("CliAgentRunner: streamJsonLines repassa deltas de texto reais via onToken (Fase 19, RF-19)", async () => {
  const runner = new CliAgentRunner({
    name: "fixture",
    cmd: NODE,
    decideArgs: ["-e", streamJsonScript(["{\"reason", "ing\": \"ok\", \"actions\": []}"], '{"reasoning": "ok", "actions": []}')],
    streamJsonLines: true,
  });
  const chunks: string[] = [];
  const decision = await runner.decide({
    system: "sys",
    user: "user",
    schema: RESPONSE_JSON_SCHEMA,
    onToken: (c) => chunks.push(c),
  });
  assert.deepEqual(chunks, ["{\"reason", "ing\": \"ok\", \"actions\": []}"]);
  assert.equal(decision.reasoning, "ok");
});

test("CliAgentRunner: streamJsonLines ignora linhas malformadas sem derrubar o turno", async () => {
  const runner = new CliAgentRunner({
    name: "fixture",
    cmd: NODE,
    decideArgs: ["-e", streamJsonScript(["oi"], '{"reasoning": "apesar do lixo", "actions": []}')],
    streamJsonLines: true,
  });
  const decision = await runner.decide({ system: "sys", user: "user", schema: RESPONSE_JSON_SCHEMA });
  assert.equal(decision.reasoning, "apesar do lixo");
});

test("CliAgentRunner: healthy() reflete o código de saída do CLI", async () => {
  const ok = new CliAgentRunner({ name: "fixture", cmd: NODE, decideArgs: [], healthArgs: ["-e", "process.exit(0)"] });
  assert.equal(await ok.healthy(), true);
  const bad = new CliAgentRunner({ name: "fixture", cmd: NODE, decideArgs: [], healthArgs: ["-e", "process.exit(1)"] });
  assert.equal(await bad.healthy(), false);
});
