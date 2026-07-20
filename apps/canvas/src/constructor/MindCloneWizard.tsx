import { useState } from "react";
import type { MindClone } from "@genius/canon";
import { constructorApi } from "../api/constructorApi.js";

const LAYERS: Array<{ key: keyof Pick<MindClone, "identidade" | "conhecimento" | "raciocinioOperacional" | "comunicacao" | "restricoes" | "evolucao">; label: string; ajuda: string }> = [
  { key: "identidade", label: "Identidade", ajuda: "Quem é esta pessoa? Cargo, papel, como se apresenta." },
  { key: "conhecimento", label: "Conhecimento", ajuda: "O que ela sabe de verdade — domínio, experiência, histórico." },
  { key: "raciocinioOperacional", label: "Raciocínio Operacional", ajuda: "Como ela aborda um problema, passo a passo." },
  { key: "comunicacao", label: "Comunicação", ajuda: "Como ela apresenta resultados — tom, formato, nível de detalhe." },
  { key: "restricoes", label: "Restrições", ajuda: "O que ela nunca faria ou decidiria sozinha." },
  { key: "evolucao", label: "Evolução", ajuda: "Que tipo de aprendizado pode ser incorporado com o tempo." },
];

export interface MindCloneWizardProps {
  onCreated: () => void;
}

/** Wizard de criação de Mind-Clone (Etapa 4): perguntas guiadas por camada + upload de documentos de referência. */
export function MindCloneWizard({ onCreated }: MindCloneWizardProps) {
  const [nome, setNome] = useState("");
  const [layers, setLayers] = useState<Record<string, string>>({});
  const [docNames, setDocNames] = useState<string[]>([]);
  const [criarAgenteJunto, setCriarAgenteJunto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim()) return;
    setBusy(true);
    try {
      const clone: MindClone = {
        id: crypto.randomUUID(),
        nome,
        identidade: layers.identidade ?? "",
        conhecimento: layers.conhecimento ?? "",
        raciocinioOperacional: layers.raciocinioOperacional ?? "",
        comunicacao: layers.comunicacao ?? "",
        restricoes: layers.restricoes ?? "",
        evolucao: layers.evolucao ?? "",
        documentosReferencia: docNames,
        createdAt: new Date().toISOString(),
      };
      await constructorApi.mindClones.create(clone);

      if (criarAgenteJunto) {
        await constructorApi.agents.create({
          id: `mind-clone-${clone.id}`,
          nome: `Agente — ${nome}`,
          descricao: layers.identidade || `Agente baseado no Mind-Clone de ${nome}.`,
          skills: [],
          connectors: [],
          autonomia: "A0",
          origem: "mind-clone",
          mindCloneId: clone.id,
          createdAt: new Date().toISOString(),
        });
      }

      setDone(clone.nome);
      setNome("");
      setLayers({});
      setDocNames([]);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--cor-borda)", borderRadius: 6, padding: 12, marginTop: 12 }}>
      <strong>Criar Mind-Clone</strong>
      <p style={{ color: "var(--cor-texto-suave)", fontSize: 11, marginTop: 2 }}>
        Perfil cognitivo estruturado de uma pessoa real — a base de DNA de um agente.
      </p>

      <input
        placeholder="Nome da pessoa"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        style={{ width: "100%", padding: 6, margin: "6px 0", border: "1px solid var(--cor-borda)", borderRadius: 4 }}
      />

      {LAYERS.map(({ key, label, ajuda }) => (
        <div key={key} style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
          <div style={{ color: "var(--cor-texto-apagado)", fontSize: 11 }}>{ajuda}</div>
          <textarea
            value={layers[key] ?? ""}
            onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.value }))}
            rows={2}
            style={{ width: "100%", padding: 4, border: "1px solid var(--cor-borda)", borderRadius: 4, resize: "vertical" }}
          />
        </div>
      ))}

      <label style={{ fontSize: 12, fontWeight: 600 }}>Documentos de referência (relatórios, e-mails, decisões passadas)</label>
      <input
        type="file"
        multiple
        onChange={(e) => setDocNames(Array.from(e.target.files ?? []).map((f) => f.name))}
        style={{ display: "block", margin: "4px 0" }}
      />
      {docNames.length > 0 && <div style={{ fontSize: 11, color: "var(--cor-texto-suave)" }}>{docNames.join(", ")}</div>}

      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, marginTop: 8 }}>
        <input type="checkbox" checked={criarAgenteJunto} onChange={(e) => setCriarAgenteJunto(e.target.checked)} />
        Criar também um Agente baseado neste Mind-Clone
      </label>

      <button type="button" onClick={criar} disabled={busy || !nome.trim()} style={{ marginTop: 8, padding: 6, cursor: "pointer" }}>
        {busy ? "Criando..." : "Criar Mind-Clone"}
      </button>
      {done && <div style={{ color: "var(--cor-sucesso)", fontSize: 12, marginTop: 4 }}>Criado: {done}</div>}
    </div>
  );
}
