/**
 * Gera as golden fixtures executando UMA implementação do compilador de
 * organograma (so-ia original ou @genius/org-compiler) sobre a mesma bateria
 * de entradas. Rodando contra as duas e comparando os JSONs, provamos
 * equivalência de comportamento.
 *
 * Uso: node generate.mjs <dir-do-build> <saida.json|->
 *
 * Com `-` como saída, escreve em stdout (é assim que o golden test o usa).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , buildDir, output] = process.argv;
const base = resolve(buildDir);

// No so-ia o org-chart mora em `data/`; no pacote extraído, ao lado dos demais.
const orgChart = await import(`${base}/orgChart.js`).catch(() => import(`${base}/../data/org-chart.js`));
const importMod = await import(`${base}/import.js`);
const relevance = await import(`${base}/relevance.js`);
const matching = await import(`${base}/matching.js`);
const squads = await import(`${base}/squads.js`);
const squadRegistry = await import(`${base}/squad-registry.js`);
const templates = await import(`${base}/templates.js`);
const workflowBuilder = await import(`${base}/workflow-builder.js`);
const skillsRegistry = await import(`${base}/skills-registry.js`);

/** Ids gerados aleatoriamente não podem entrar na comparação. */
function stable(value) {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (key === "criadoEm" || key === "criadaEm") return "<timestamp>";
      if (typeof item === "string" && /^node-[a-z0-9]{7}$/.test(item)) return "<node-id>";
      return item;
    }),
  );
}

const ORG_TEXT_CASES = [
  "Reitoria; Gabinete; conduzir a política institucional\nPró-Reitoria de Ensino; Ensino; coordenar os cursos",
  "Diretoria Financeira,Financeiro,pagar fornecedores;emitir notas",
  "- Comercial\n  - Vendas\n  - Pré-vendas",
  "",
  "Coordenação de Licitações e Contratos | Licitações e Contratos | fiscalizar contratos",
];

const COVERAGE_CASES = [
  { area: "Licitações e Contratos", texto: "redigir parecer sobre contrato administrativo" },
  { area: "Financeiro", texto: "emitir nota fiscal" },
  { area: "Ensino", texto: "atualizar o projeto pedagógico do curso" },
  { area: "Marketing", texto: "campanha de mídia paga" },
  { area: "Gabinete", texto: "" },
];

const NODE_CASES = [
  { id: "n1", titulo: "Coordenação de Contratos", area: "Licitações e Contratos", responsabilidades: ["fiscalizar contratos", "instruir processos"], parentId: null },
  { id: "n2", titulo: "Diretoria Financeira", area: "Financeiro", responsabilidades: ["pagar fornecedores"], parentId: "n1" },
  { id: "n3", titulo: "Assessoria de Comunicação", area: "Comunicação", responsabilidades: ["redigir notas à imprensa"], parentId: null },
  { id: "n4", titulo: "Setor Sem Correspondência", area: "Zoologia Aplicada", responsabilidades: ["observar aves"], parentId: null },
];

const golden = {
  slugify: ["Ação & Reação", "Pró-Reitoria de Ensino", "  espaços  ", "ÁÉÍÓÚ", ""].map((input) => ({
    input,
    output: orgChart.slugify(input),
  })),

  buildTree: stable(orgChart.buildTree(NODE_CASES)),

  parseOrgText: ORG_TEXT_CASES.map((input) => ({
    input,
    output: stable(importMod.parseOrgText(input)),
  })),

  parseOrgPasted: ORG_TEXT_CASES.map((input) => ({
    input,
    output: stable(importMod.parseOrgPasted(input)),
  })),

  parseOrgFile: [
    { filename: "org.csv", content: "titulo,area,responsabilidades\nReitoria,Gabinete,conduzir" },
    { filename: "org.txt", content: ORG_TEXT_CASES[0] },
  ].map(({ filename, content }) => ({
    filename,
    output: stable(importMod.parseOrgFile(filename, content)),
  })),

  organizationCovers: COVERAGE_CASES.flatMap((topic) => [
    { topic, nodes: "NODE_CASES", output: relevance.organizationCovers(topic, NODE_CASES) },
    { topic, nodes: "vazio", output: relevance.organizationCovers(topic, []) },
    { topic, nodes: "templateGoverno", output: relevance.organizationCovers(topic, templates.templateGoverno) },
    { topic, nodes: "templateEmpresa", output: relevance.organizationCovers(topic, templates.templateEmpresa) },
  ]),

  matchNode: NODE_CASES.map((node) => ({ node: node.id, output: stable(matching.matchNode(node)) })),

  assembleOrganization: stable(matching.assembleOrganization(NODE_CASES)),
  assembleGoverno: stable(matching.assembleOrganization(templates.templateGoverno)),
  assembleEmpresa: stable(matching.assembleOrganization(templates.templateEmpresa)),

  institutionalCatalog: stable(matching.institutionalCatalog),

  buildSquads: stable(squads.buildSquads(matching.assembleOrganization(NODE_CASES))),
  buildSquadsGoverno: stable(squads.buildSquads(matching.assembleOrganization(templates.templateGoverno))),

  institutionalSquads: stable(squadRegistry.institutionalSquads),
  loadRepository: stable(squadRegistry.loadRepository()),
  bestBuilderSquad: stable(squadRegistry.bestBuilderSquad()),
  findSquadTemplate: ["Licitações e Contratos", "Financeiro", "Clientes", "Zoologia Aplicada", ""].map((area) => ({
    area,
    output: stable(squadRegistry.findSquadTemplate(area)),
  })),
  createSquadTemplate: [
    { area: "Patrimônio", responsabilidades: ["inventariar bens"] },
    { area: "Zoologia Aplicada", responsabilidades: [] },
  ].map(({ area, responsabilidades }) => ({
    area,
    output: stable(squadRegistry.createSquadTemplate(area, responsabilidades, { dryRun: true })),
  })),

  templates: stable({ empresa: templates.templateEmpresa, governo: templates.templateGoverno }),

  buildOrgWorkflow: stable(
    matching.assembleOrganization(NODE_CASES).map((assignment) => workflowBuilder.buildOrgWorkflow(assignment)),
  ),
  pickWorkflowAssignment: stable(
    workflowBuilder.pickWorkflowAssignment(matching.assembleOrganization(NODE_CASES)),
  ),

  skillsRegistry: stable({
    ensure: skillsRegistry.ensureSkill("fiscalizar-contratos", "Fiscaliza contratos administrativos."),
    get: skillsRegistry.getSkill("fiscalizar-contratos") ?? null,
    listSize: skillsRegistry.listSkills().length,
  }),
};

const serialized = `${JSON.stringify(golden, null, 2)}\n`;
if (output === "-") {
  process.stdout.write(serialized);
} else {
  writeFileSync(output, serialized);
  console.log(`golden → ${output}`);
}
