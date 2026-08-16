import { describe, expect, it } from "vitest";
import { ORG_TOOLS, runTool } from "../src/tools.js";
import { SERVER_INFO, createOrgServer } from "../src/server.js";

const CONTRATOS = {
  id: "n1",
  titulo: "Coordenação de Licitações e Contratos",
  area: "Licitações e Contratos",
  responsabilidades: ["fiscalizar contratos", "instruir processos de compra"],
  parentId: null,
};

const ENSINO = {
  id: "n2",
  titulo: "Diretoria de Ensino",
  area: "Ensino",
  responsabilidades: ["coordenar os cursos"],
  parentId: null,
};

/** Toda ferramenta devolve texto JSON; este helper devolve já decodificado. */
function call(name: string, args: Record<string, unknown> = {}) {
  const result = runTool(name, args);
  return { payload: JSON.parse(result.content[0].text), isError: result.isError === true };
}

describe("contrato das ferramentas", () => {
  it("expõe as oito ferramentas do compilador", () => {
    expect(ORG_TOOLS.map((tool) => tool.name).sort()).toEqual([
      "org_assemble",
      "org_build_squad",
      "org_covers",
      "org_find_squad",
      "org_import",
      "org_match",
      "org_template",
      "org_workflow",
    ]);
  });

  it("toda ferramenta descreve para que serve", () => {
    for (const tool of ORG_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(80);
      expect(tool.title, tool.name).toBeTruthy();
    }
  });

  it("ferramenta desconhecida vira erro legível, não exceção", () => {
    const { payload, isError } = call("org_inexistente");
    expect(isError).toBe(true);
    expect(payload.error).toContain("desconhecida");
  });

  it("argumento inválido vira erro legível, não exceção", () => {
    const { payload, isError } = call("org_covers", { area: 123, nodes: "não é lista" });
    expect(isError).toBe(true);
    expect(payload.error).toBeTruthy();
  });

  it("o servidor MCP registra todas as ferramentas sem levantar", () => {
    const server = createOrgServer();
    expect(server).toBeTruthy();
    expect(SERVER_INFO.name).toBe("genius-organograma");
  });
});

describe("org_covers — o guarda da Lei 1", () => {
  it("cobre uma área presente no organograma", () => {
    const { payload } = call("org_covers", { area: "Licitações e Contratos", nodes: [CONTRATOS] });
    expect(payload.coberto).toBe(true);
    expect(payload.unidades).toBe(1);
  });

  it("não cobre uma área ausente — e explica por quê", () => {
    const { payload } = call("org_covers", {
      area: "Marketing",
      texto: "campanha de mídia paga",
      nodes: [CONTRATOS, ENSINO],
    });
    expect(payload.coberto).toBe(false);
    expect(payload.justificativa).toContain("nenhuma unidade");
  });

  it("sem organograma carregado, nada é coberto", () => {
    const { payload } = call("org_covers", { area: "Ensino", nodes: [] });
    expect(payload.coberto).toBe(false);
    expect(payload.justificativa).toContain("sem organograma");
  });

  it("cobre pelo texto quando as responsabilidades tratam do assunto", () => {
    const { payload } = call("org_covers", {
      area: "Compras",
      texto: "fiscalizar contrato administrativo",
      nodes: [CONTRATOS],
    });
    expect(payload.coberto).toBe(true);
  });
});

describe("importação e montagem", () => {
  it("importa organograma de texto com hierarquia por indentação", () => {
    const { payload } = call("org_import", { content: "Comercial\n  Vendas\n  Pré-vendas" });
    expect(payload.nodes).toHaveLength(3);
    expect(payload.format).toBeTruthy();
  });

  it("importa colagem de planilha", () => {
    const { payload } = call("org_import", { content: "Reitoria\tGabinete", pasted: true });
    expect(payload.nodes.length).toBeGreaterThan(0);
  });

  it("importa por arquivo, escolhendo o parser pelo nome", () => {
    const { payload } = call("org_import", {
      filename: "org.csv",
      content: "titulo,area,responsabilidades\nReitoria,Gabinete,conduzir",
    });
    expect(payload.nodes.length).toBeGreaterThan(0);
  });

  it("resolve uma unidade reaproveitando ou gerando agente", () => {
    const { payload } = call("org_match", { node: CONTRATOS });
    expect(payload.agent).toBeTruthy();
    expect(["catalogo", "gerado"]).toContain(payload.origem);
  });

  it("monta a organização inteira", () => {
    const { payload } = call("org_assemble", { nodes: [CONTRATOS, ENSINO] });
    expect(payload).toHaveLength(2);
  });

  it("monta squads e informa o repositório consultado", () => {
    const { payload } = call("org_build_squad", { nodes: [CONTRATOS, ENSINO] });
    expect(payload.squads.length).toBeGreaterThan(0);
    expect(payload.repositorio.length).toBeGreaterThan(0);
  });

  it("deriva workflow por unidade", () => {
    const { payload } = call("org_workflow", { nodes: [CONTRATOS] });
    expect(payload[0].steps.length).toBeGreaterThan(0);
  });

  it("carrega organograma-semente", () => {
    const { payload } = call("org_template", { tipo: "governo" });
    expect(payload.length).toBeGreaterThan(0);
  });
});

describe("org_find_squad — criar é deliberado, nunca automático", () => {
  it("encontra template compatível quando existe", () => {
    const { payload } = call("org_find_squad", { area: "Licitações e Contratos" });
    expect(payload.encontrado).toBe(true);
    expect(payload.squad).toBeTruthy();
  });

  it("não inventa squad quando não há compatível", () => {
    const { payload } = call("org_find_squad", { area: "Zoologia Aplicada" });
    expect(payload.encontrado).toBe(false);
    expect(payload.squad).toBeNull();
    expect(payload.proposta).toBeUndefined();
  });

  it("propõe — sem persistir — só quando explicitamente pedido", () => {
    const { payload } = call("org_find_squad", {
      area: "Zoologia Aplicada",
      criar: true,
      responsabilidades: ["observar aves"],
    });
    expect(payload.proposta.origem).toBe("criado");
    // Nada foi gravado: uma segunda busca continua não encontrando.
    expect(call("org_find_squad", { area: "Zoologia Aplicada" }).payload.encontrado).toBe(false);
  });
});
