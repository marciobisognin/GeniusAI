import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OpenAICodexAdapter } from "../src/openaiCodexAdapter.js";

const FIXTURE = fileURLToPath(new URL("./fixtures/fake-codex-cli.mjs", import.meta.url));

describe("OpenAICodexAdapter — processo real (fixture CLI), sem precisar do Codex instalado", () => {
  it("healthy() roda o processo de verdade com --version", async () => {
    const adapter = new OpenAICodexAdapter({
      cmd: process.execPath,
      healthArgs: [FIXTURE, "--version"],
    });
    await expect(adapter.healthy()).resolves.toBe(true);
  });

  it("healthy() false quando o binário não existe", async () => {
    const adapter = new OpenAICodexAdapter({ cmd: "binario-que-nao-existe-de-verdade" });
    await expect(adapter.healthy()).resolves.toBe(false);
  });

  it("complete() envia o prompt por stdin e lê stdout de verdade", async () => {
    const adapter = new OpenAICodexAdapter({
      cmd: process.execPath,
      completeArgs: [FIXTURE],
    });
    const result = await adapter.complete({ system: "persona", prompt: "faça algo" });
    expect(result.text).toBe("ECHO: persona\n\nfaça algo");
  });

  it("complete() rejeita quando o processo sai com código de erro", async () => {
    const adapter = new OpenAICodexAdapter({
      cmd: process.execPath,
      completeArgs: [FIXTURE, "--fail"],
    });
    await expect(adapter.complete({ prompt: "oi" })).rejects.toThrow(/código de saída 1/);
  });
});
