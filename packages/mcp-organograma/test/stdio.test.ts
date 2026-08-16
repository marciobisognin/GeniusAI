import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/bin.js");

/**
 * Verificação de ponta a ponta: um cliente MCP real conversa com o servidor
 * por stdio, como o Hermes (ou o Claude Code) faria. Sem isto, o teste de
 * unidade provaria a lógica e não o protocolo.
 *
 * Depende do build: `npm run build -w packages/mcp-organograma`.
 */
describe("servidor MCP por stdio", () => {
  let client: Client;

  beforeAll(async () => {
    expect(existsSync(BIN), "dist/bin.js ausente — rode o build antes do teste").toBe(true);
    client = new Client({ name: "teste", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [BIN] }));
  }, 30_000);

  afterAll(async () => {
    await client?.close();
  });

  it("anuncia as ferramentas com descrição", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "org_assemble",
      "org_build_squad",
      "org_covers",
      "org_find_squad",
      "org_import",
      "org_match",
      "org_template",
      "org_workflow",
    ]);
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema, tool.name).toBeTruthy();
    }
  });

  it("aplica a Lei 1 numa chamada real", async () => {
    const nodes = [
      {
        id: "n1",
        titulo: "Coordenação de Licitações e Contratos",
        area: "Licitações e Contratos",
        responsabilidades: ["fiscalizar contratos"],
        parentId: null,
      },
    ];

    const coberto = await client.callTool({ name: "org_covers", arguments: { area: "Licitações e Contratos", nodes } });
    expect(JSON.parse((coberto.content as Array<{ text: string }>)[0].text).coberto).toBe(true);

    const ausente = await client.callTool({ name: "org_covers", arguments: { area: "Marketing", nodes } });
    expect(JSON.parse((ausente.content as Array<{ text: string }>)[0].text).coberto).toBe(false);
  });

  it("importa e monta numa sequência de chamadas", async () => {
    const imported = await client.callTool({
      name: "org_import",
      arguments: { content: "Comercial\n  Vendas\n  Pré-vendas" },
    });
    const { nodes } = JSON.parse((imported.content as Array<{ text: string }>)[0].text);
    expect(nodes).toHaveLength(3);

    const assembled = await client.callTool({ name: "org_assemble", arguments: { nodes } });
    expect(JSON.parse((assembled.content as Array<{ text: string }>)[0].text)).toHaveLength(3);
  });

  it("erro de argumento volta como erro do protocolo, sem derrubar o servidor", async () => {
    const bad = await client.callTool({ name: "org_covers", arguments: { area: 123 } });
    expect(bad.isError).toBe(true);

    // O servidor continua vivo depois do erro.
    const { tools } = await client.listTools();
    expect(tools.length).toBe(8);
  });
});
