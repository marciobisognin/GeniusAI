import { useEffect, useState } from "react";
import type { Agent, Company, Squad } from "@genius/canon";
import { constructorApi, type AvailablePackFile } from "../api/constructorApi.js";
import { libraryApi } from "../api/libraryApi.js";
import { MatchForm } from "./MatchForm.js";
import { MindCloneWizard } from "./MindCloneWizard.js";

export interface ConstructorScreenProps {
  onBackToCanvas: () => void;
}

/**
 * Tela do Super Construtor (Etapa 4) — fora do canvas: montar
 * Company → Squad → Agent/Mind-Clone com formulários guiados, reaproveitando
 * ou criando (nunca do zero sem antes checar o que já existe).
 */
export function ConstructorScreen({ onBackToCanvas }: ConstructorScreenProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [novaCompanyNome, setNovaCompanyNome] = useState("");
  const [packJson, setPackJson] = useState<string | null>(null);
  const [importTargetCompanyId, setImportTargetCompanyId] = useState("");
  const [availablePacks, setAvailablePacks] = useState<AvailablePackFile[]>([]);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  async function reloadAll() {
    const [c, s, a] = await Promise.all([
      constructorApi.companies.list(),
      libraryApi.listSquads(),
      libraryApi.listAgents(),
    ]);
    setCompanies(c);
    setSquads(s);
    setAgents(a);
  }

  useEffect(() => {
    void reloadAll();
    void constructorApi.packs.listAvailable().then(setAvailablePacks);
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const squadsOfCompany = selectedCompany ? squads.filter((s) => selectedCompany.squadIds.includes(s.id)) : [];

  async function criarCompany() {
    if (!novaCompanyNome.trim()) return;
    const created = await constructorApi.companies.create({
      id: crypto.randomUUID(),
      nome: novaCompanyNome,
      squadIds: [],
      createdAt: new Date().toISOString(),
    });
    setNovaCompanyNome("");
    await reloadAll();
    setSelectedCompanyId(created.id);
  }

  async function linkSquadToCompany(squadId: string) {
    if (!selectedCompany) return;
    const squadIds = [...new Set([...selectedCompany.squadIds, squadId])];
    await constructorApi.companies.update(selectedCompany.id, { squadIds });
    await reloadAll();
  }

  async function linkAgentToSquad(squad: Squad, agentId: string) {
    const agentIds = [...new Set([...squad.agentIds, agentId])];
    await constructorApi.squads.update(squad.id, { agentIds });
    await reloadAll();
  }

  async function exportarPack() {
    if (!selectedCompany) return;
    const pack = await constructorApi.packs.exportCompany(selectedCompany.id);
    setPackJson(JSON.stringify(pack, null, 2));
  }

  async function importarArquivo(filename: string) {
    if (!selectedCompany) return;
    const result = await constructorApi.packs.importFile(filename, selectedCompany.id);
    setImportFeedback(
      `${result.squadsNovos.length} squad(s) novo(s), ${result.squadsExistentes.length} já existiam · ${result.agentesNovos.length} agente(s) novo(s), ${result.agentesExistentes.length} já existiam`,
    );
    await reloadAll();
  }

  /** Reimporta o Pack acabado de exportar diretamente em outra Company — sem precisar escrever arquivo em disco. */
  async function importarPackJsonEmOutraCompany() {
    if (!packJson || !importTargetCompanyId) return;
    const pack = JSON.parse(packJson);
    const result = await constructorApi.packs.importIntoCompany(importTargetCompanyId, pack);
    setImportFeedback(
      `Reimportado em "${result.company.nome}": ${result.squadsNovos.length} squad(s) novo(s), ${result.squadsExistentes.length} já existiam · ${result.agentesNovos.length} agente(s) novo(s), ${result.agentesExistentes.length} já existiam`,
    );
    await reloadAll();
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflowY: "auto", fontFamily: "system-ui, sans-serif", fontSize: 13, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 18 }}>Super Construtor</h1>
        <button type="button" onClick={onBackToCanvas} style={{ padding: "6px 12px", cursor: "pointer" }}>
          ← Voltar ao Canvas
        </button>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ width: 260 }}>
          <strong>Companies</strong>
          <ul style={{ listStyle: "none", margin: "6px 0", padding: 0 }}>
            {companies.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCompanyId(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 6,
                    marginBottom: 4,
                    cursor: "pointer",
                    background: c.id === selectedCompanyId ? "#eff6ff" : "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                  }}
                >
                  {c.nome} <span style={{ color: "#9ca3af" }}>({c.squadIds.length} squad(s))</span>
                </button>
              </li>
            ))}
          </ul>
          <input
            placeholder="Nova Company"
            value={novaCompanyNome}
            onChange={(e) => setNovaCompanyNome(e.target.value)}
            style={{ width: "100%", padding: 6, border: "1px solid #e5e7eb", borderRadius: 4 }}
          />
          <button type="button" onClick={criarCompany} style={{ width: "100%", padding: 6, marginTop: 4, cursor: "pointer" }}>
            Criar Company
          </button>

          <MindCloneWizard onCreated={reloadAll} />
        </div>

        <div style={{ flex: 1 }}>
          {!selectedCompany && <p style={{ color: "#9ca3af" }}>Selecione ou crie uma Company para começar.</p>}
          {selectedCompany && (
            <div>
              <h2 style={{ fontSize: 16 }}>{selectedCompany.nome}</h2>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button type="button" onClick={exportarPack} style={{ padding: "4px 8px", cursor: "pointer" }}>
                  Exportar como Pack
                </button>
              </div>
              {packJson && (
                <div style={{ marginBottom: 12 }}>
                  <pre style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: 8, maxHeight: 160, overflow: "auto" }}>
                    {packJson}
                  </pre>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 12 }}>Reimportar em:</span>
                    <select value={importTargetCompanyId} onChange={(e) => setImportTargetCompanyId(e.target.value)}>
                      <option value="">Escolha uma Company...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={importarPackJsonEmOutraCompany}
                      disabled={!importTargetCompanyId}
                      style={{ padding: "2px 8px", cursor: "pointer" }}
                    >
                      Reimportar este Pack
                    </button>
                  </div>
                </div>
              )}

              {availablePacks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 12 }}>Packs disponíveis na pasta packs/</strong>
                  <ul style={{ listStyle: "none", margin: "4px 0", padding: 0 }}>
                    {availablePacks.map((p) => (
                      <li key={p.filename} style={{ marginBottom: 4 }}>
                        {p.valid ? (
                          <button type="button" onClick={() => importarArquivo(p.filename)} style={{ padding: "2px 8px", cursor: "pointer" }}>
                            Importar "{p.nome}" ({p.filename})
                          </button>
                        ) : (
                          <span style={{ color: "#dc2626" }}>{p.filename}: inválido</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importFeedback && (
                <div style={{ color: "#16a34a", fontSize: 12, marginBottom: 12 }}>{importFeedback}</div>
              )}

              <strong>Squads</strong>
              {squadsOfCompany.map((squad) => (
                <div key={squad.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8, marginTop: 6 }}>
                  <strong>{squad.nome}</strong> <span style={{ color: "#9ca3af", fontSize: 11 }}>({squad.origem})</span>
                  <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                    {squad.agentIds.map((id) => {
                      const agent = agents.find((a) => a.id === id);
                      return <li key={id}>{agent?.nome ?? id}</li>;
                    })}
                  </ul>
                  <MatchForm<Agent>
                    label="Adicionar agente a este squad"
                    placeholderTitulo="Título da função (ex.: Fiscal de Contratos)"
                    matchFn={constructorApi.matchAgent}
                    createFn={constructorApi.agents.create}
                    onLinked={(id) => linkAgentToSquad(squad, id)}
                  />
                </div>
              ))}

              <MatchForm<Squad>
                label="Adicionar squad a esta Company"
                placeholderTitulo="Área/time (ex.: Licitações e Contratos)"
                matchFn={constructorApi.matchSquad}
                createFn={constructorApi.squads.create}
                onLinked={linkSquadToCompany}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
