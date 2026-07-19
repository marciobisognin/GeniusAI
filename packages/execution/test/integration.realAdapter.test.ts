import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Agent } from "@genius/canon";
import { OllamaAdapter } from "@genius/providers";
import { afterEach, describe, expect, it } from "vitest";
import { runAgentTurn } from "../src/runAgentTurn.js";

/** Servidor HTTP real simulando um Ollama local — prova que o motor fala com um adapter de verdade, não um fake em memória. */
function startFakeOllama(replyText: string): Promise<{ url: string; close: () => Promise<void>; lastPrompt: () => string | undefined }> {
  let lastPrompt: string | undefined;
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200).end("{}");
        return;
      }
      if (req.url === "/api/generate") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          lastPrompt = JSON.parse(body).prompt;
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: replyText }));
        });
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
        lastPrompt: () => lastPrompt,
      });
    });
  });
}

describe("runAgentTurn + OllamaAdapter real — integração de ponta a ponta do pacote", () => {
  let fakeOllama: Awaited<ReturnType<typeof startFakeOllama>> | null = null;

  afterEach(async () => {
    await fakeOllama?.close();
    fakeOllama = null;
  });

  it("chama de verdade um servidor HTTP via OllamaAdapter e devolve a resposta real", async () => {
    fakeOllama = await startFakeOllama("Atesto conferido: NF 2041 confere com o empenho 12/2025.");
    const adapter = new OllamaAdapter({ host: fakeOllama.url, model: "llama3" });

    const agent: Agent = {
      id: "agente-atesto-nf",
      nome: "Agente de Atesto de Nota Fiscal",
      area: "Orçamento e Finanças",
      descricao: "Confere NF contra empenho.",
      skills: ["conferir-nf-contra-empenho"],
      connectors: [],
      autonomia: "A2",
      origem: "importado",
      createdAt: new Date().toISOString(),
    };

    const events: { type: string; message: string }[] = [];
    const result = await runAgentTurn({
      agent,
      adapter,
      taskDescription: "Confira a NF 2041 do contrato 12/2025",
      runId: "run-real-1",
      onEvent: (e) => events.push(e),
    });

    expect(result.text).toBe("Atesto conferido: NF 2041 confere com o empenho 12/2025.");
    expect(result.requiresApproval).toBe(true); // A2
    expect(fakeOllama.lastPrompt()).toBe("Confira a NF 2041 do contrato 12/2025");
    expect(events.map((e) => e.type)).toEqual(["task.step", "task.tool_call", "task.awaiting_approval"]);
  });
});
