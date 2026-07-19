#!/usr/bin/env node
// CLI fake real (processo de verdade, não simulado em memória) para testar
// o OpenAICodexAdapter sem depender do binário real do Codex estar
// instalado neste ambiente.
if (process.argv.includes("--version")) {
  process.stdout.write("fake-codex 0.0.1\n");
  process.exit(0);
}
if (process.argv.includes("--fail")) {
  process.stderr.write("erro simulado\n");
  process.exit(1);
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  process.stdout.write(`ECHO: ${input.trim()}`);
  process.exit(0);
});
