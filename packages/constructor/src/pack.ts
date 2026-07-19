import { Pack, type Agent, type Company, type Squad } from "@genius/canon";
import type { Repository } from "./db.js";

export interface PackRepos {
  companies: Repository<Company>;
  squads: Repository<Squad>;
  agents: Repository<Agent>;
}

export class CompanyNotFoundError extends Error {}

/** Empacota uma Company inteira (seus squads e os agentes desses squads) num Pack portátil. */
export function exportCompanyAsPack(companyId: string, repos: PackRepos): Pack {
  const company = repos.companies.getById(companyId);
  if (!company) throw new CompanyNotFoundError(`Company "${companyId}" não encontrada.`);

  const squads = company.squadIds
    .map((id) => repos.squads.getById(id))
    .filter((s): s is Squad => Boolean(s));

  const agentIds = new Set(squads.flatMap((s) => s.agentIds));
  const agents = [...agentIds].map((id) => repos.agents.getById(id)).filter((a): a is Agent => Boolean(a));

  return Pack.parse({
    id: `pack-${company.id}`,
    nome: company.nome,
    versao: "1.0.0",
    agents,
    squads,
    skills: [],
    workflows: [],
  });
}

export interface ImportPackResult {
  agentesNovos: string[];
  agentesExistentes: string[];
  squadsNovos: string[];
  squadsExistentes: string[];
  company: Company;
}

/**
 * Importa um Pack para dentro de uma Company (upsert por id — reimportar o
 * mesmo Pack na mesma Company produz o mesmo resultado, nunca duplica). Os
 * squads do Pack passam a apontar para esta Company (`companyId`), e a
 * Company passa a listá-los em `squadIds`.
 */
export function importPackIntoCompany(pack: Pack, companyId: string, repos: PackRepos): ImportPackResult {
  const company = repos.companies.getById(companyId);
  if (!company) throw new CompanyNotFoundError(`Company "${companyId}" não encontrada.`);

  const agentesNovos: string[] = [];
  const agentesExistentes: string[] = [];
  for (const agent of pack.agents) {
    (repos.agents.getById(agent.id) ? agentesExistentes : agentesNovos).push(agent.id);
    repos.agents.insert(agent);
  }

  const squadsNovos: string[] = [];
  const squadsExistentes: string[] = [];
  for (const squad of pack.squads) {
    (repos.squads.getById(squad.id) ? squadsExistentes : squadsNovos).push(squad.id);
    repos.squads.insert({ ...squad, companyId });
  }

  const squadIds = new Set([...company.squadIds, ...pack.squads.map((s) => s.id)]);
  const updatedCompany = repos.companies.update(companyId, { squadIds: [...squadIds] })!;

  return { agentesNovos, agentesExistentes, squadsNovos, squadsExistentes, company: updatedCompany };
}
