import { serve } from "bun";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const PORT = Number(process.env.NIRVANA_BRIDGE_PORT ?? 4000);
const HOST = process.env.NIRVANA_BRIDGE_HOST ?? "127.0.0.1";
const ENGINE_PATH = process.env.NIRVANA_ENGINE_PATH ?? "";
const ORG_CHART_PATH = process.env.IFFAR_ORG_CHART_PATH ?? "";
const TICKETS_DIR = process.env.IFFAR_TICKETS_DIR ?? "";
const OUTPUTS_DIR = process.env.IFFAR_OUTPUTS_DIR ?? "";

function isAllowedArtifact(filePath: string) {
  return [TICKETS_DIR, OUTPUTS_DIR].filter(Boolean).some((directory) => {
    const root = resolve(directory);
    const candidate = resolve(filePath);
    const pathFromRoot = relative(root, candidate);
    return (
      pathFromRoot === "" ||
      (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
    );
  });
}

console.log(`Starting Nirvana Bridge on port ${PORT}...`);

// Smart Organogram Handoff Router based on IFFar Responsibilities
function buildOrganogramSequence(problem: string) {
  const p = problem.toLowerCase();

  // 1. Identify Sector Responsibility
  let sectorUnit = "unit-1-1-4-gabinete-do-a-reit-or-a-reit-or-a-cd-0001";
  let sectorAction = "Análise de Gabinete e Encaminhamento";

  if (
    p.includes("contrato") ||
    p.includes("licita") ||
    p.includes("in 05") ||
    p.includes("fiscaliz") ||
    p.includes("legal") ||
    p.includes("auditor")
  ) {
    sectorUnit = "unit-1-1-2-audit-oria-interna";
    sectorAction = "Análise Legal e Fiscalização Contratual (IN 05/2017)";
  } else if (
    p.includes("ensino") ||
    p.includes("pdi") ||
    p.includes("gradua") ||
    p.includes("curso") ||
    p.includes("pedagog")
  ) {
    sectorUnit = "unit-1-1-16-pro-reit-oria-de-ensino-pro-reit-or-a-cd-0002";
    sectorAction = "Instrução Pedagógica e Diretrizes de Ensino";
  } else if (
    p.includes("extens") ||
    p.includes("social") ||
    p.includes("comunidad") ||
    p.includes("projeto")
  ) {
    sectorUnit = "unit-1-1-18-pro-reit-oria-de-extens-ao-pro-reit-or-a-cd-0002";
    sectorAction = "Alocação de Projetos de Extensão e Ação Comunitária";
  }

  // 2. Identify Campus Target
  let campusUnit = "unit-1-2-campus-alegrete";
  let campusName = "Campus Alegrete";

  if (p.includes("panambi")) {
    campusUnit = "unit-1-6-campus-panambi";
    campusName = "Campus Panambi";
  } else if (p.includes("santo ângelo") || p.includes("santo angelo")) {
    campusUnit = "unit-1-11-campus-sant-o-angel-o";
    campusName = "Campus Santo Ângelo";
  } else if (p.includes("santa rosa")) {
    campusUnit = "unit-1-7-campus-santa-rosa";
    campusName = "Campus Santa Rosa";
  } else if (p.includes("são vicente") || p.includes("sao vicente")) {
    campusUnit = "unit-1-3-campus-sao-vicente-do-sul";
    campusName = "Campus São Vicente do Sul";
  } else if (p.includes("júlio") || p.includes("julio")) {
    campusUnit = "unit-1-4-campus-julio-de-cas-tilhos";
    campusName = "Campus Júlio de Castilhos";
  } else if (p.includes("são borja") || p.includes("sao borja")) {
    campusUnit = "unit-1-8-campus-sao-borj-a";
    campusName = "Campus São Borja";
  } else if (p.includes("frederico")) {
    campusUnit = "unit-1-9-campus-frederic-o-we-stphalen";
    campusName = "Campus Frederico Westphalen";
  } else if (p.includes("jaguari")) {
    campusUnit = "unit-1-10-campus-jaguari";
    campusName = "Campus Jaguari";
  } else if (p.includes("uruguaiana")) {
    campusUnit = "unit-1-12-campus-urugu-aiana";
    campusName = "Campus Uruguaiana";
  } else if (p.includes("santiago")) {
    campusUnit = "unit-1-14-campus-santia-go";
    campusName = "Campus Santiago";
  }

  // Strict Organogram Parent-Child Chain
  return [
    {
      from: "user",
      to: "unit-1-1-reit-oria",
      action: `Recebendo Briefing Institucional: "${problem.substring(0, 25)}..."`,
      delay: 500,
    },
    {
      from: "unit-1-1-reit-oria",
      to: sectorUnit,
      action: `Despacho para Setor Competente: ${sectorAction}`,
      delay: 4000,
    },
    {
      from: sectorUnit,
      to: campusUnit,
      action: `Execução e Validação Tática no ${campusName}`,
      delay: 8500,
    },
    {
      from: campusUnit,
      to: sectorUnit,
      action: `Devolução do Relatório Técnico de Campo`,
      delay: 13000,
    },
    {
      from: sectorUnit,
      to: "unit-1-1-reit-oria",
      action: `Consolidação dos Dados e Emissão de Parecer Final`,
      delay: 16500,
    },
    {
      from: "unit-1-1-reit-oria",
      to: "user",
      action: `Artefato Final Aprovado e Disponibilizado`,
      delay: 20000,
    },
  ];
}

serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS Preflight
    if (req.method === "OPTIONS") {
      return new Response("OK", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Endpoint for reading and returning local artifact file content
    if (url.pathname === "/api/view-artifact" && req.method === "GET") {
      try {
        const filePath = url.searchParams.get("file");
        if (
          !filePath ||
          !isAllowedArtifact(filePath) ||
          !existsSync(filePath)
        ) {
          return new Response(
            "# Arquivo não encontrado\nO relatório ainda está sendo gerado ou o caminho expirou.",
            {
              status: 404,
              headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }
        const content = readFileSync(filePath, "utf8");
        return new Response(content, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(`# Erro ao abrir arquivo\n${err.message}`, {
          status: 500,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (url.pathname === "/api/org-chart" && req.method === "GET") {
      try {
        const fileContent = readFileSync(ORG_CHART_PATH, "utf8");
        return new Response(fileContent, {
          headers: {
            "Content-Type": "text/yaml",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    if (url.pathname === "/api/brief" && req.method === "POST") {
      try {
        const body = await req.json();
        const problem = body.problem;

        if (!problem) {
          return new Response(JSON.stringify({ error: "Missing problem" }), {
            status: 400,
          });
        }

        if (!ENGINE_PATH || !existsSync(ENGINE_PATH)) {
          return new Response(
            JSON.stringify({
              error: "NIRVANA_ENGINE_PATH não configurado ou inexistente",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        console.log(`[Bridge] Disparando IFFar com: ${problem}`);

        const sequence = buildOrganogramSequence(problem);

        const child = spawn("bun", [ENGINE_PATH, "iffar", problem], {
          stdio: "pipe",
        });

        let output = "";
        child.stdout.on("data", (data) => (output += data.toString()));
        child.stderr.on("data", (data) => (output += data.toString()));

        return new Promise((resolve) => {
          child.on("close", (code) => {
            console.log(`[Bridge] Finalizado com código ${code}`);

            let artifactLinks: string[] = [];
            if (existsSync(TICKETS_DIR)) {
              const tickets = readdirSync(TICKETS_DIR).sort().reverse();
              if (tickets.length > 0) {
                const fullPath = join(TICKETS_DIR, tickets[0], "result.md");
                artifactLinks.push(
                  `http://localhost:4000/api/view-artifact?file=${encodeURIComponent(fullPath)}`,
                );
              }
            }
            if (artifactLinks.length === 0 && OUTPUTS_DIR) {
              const fallbackPath = join(OUTPUTS_DIR, "latest_result.md");
              artifactLinks.push(
                `http://localhost:4000/api/view-artifact?file=${encodeURIComponent(fallbackPath)}`,
              );
            }

            resolve(
              new Response(
                JSON.stringify({
                  success: code === 0,
                  output: output,
                  artifacts: artifactLinks,
                  sequence: sequence,
                }),
                {
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                  },
                },
              ),
            );
          });
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});
