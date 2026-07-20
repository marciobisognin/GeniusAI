import { useEffect, useState } from "react";
import type { ProviderConfig, ProviderType } from "@genius/canon";
import { providersApi } from "../api/providersApi.js";
import { humanizeApiError } from "../api/client.js";

export interface ProvidersPanelProps {
  open: boolean;
  onClose: () => void;
  /** Notifica o board para recarregar a lista de provedores usada nos seletores dos nós. */
  onChanged: () => void;
}

const PROVIDER_TYPES: Array<{ value: ProviderType; label: string; hint: string }> = [
  { value: "anthropic", label: "Anthropic (Claude)", hint: "apiKeyRef = variável de ambiente com a chave" },
  { value: "openai-chat", label: "OpenAI (ChatGPT)", hint: "apiKeyRef = variável de ambiente com a chave" },
  { value: "openai-codex", label: "Codex (CLI)", hint: "cmd = binário do CLI, ex.: codex" },
  { value: "ollama", label: "Ollama (open-source local)", hint: "baseUrl = http://localhost:11434" },
  { value: "openai-compatible", label: "Compatível com OpenAI (OpenRouter, vLLM, LM Studio...)", hint: "baseUrl obrigatório" },
];

const emptyForm = { tipo: "ollama" as ProviderType, nome: "", baseUrl: "", apiKeyRef: "", model: "", cmd: "" };

export function ProvidersPanel({ open, onClose, onChanged }: ProvidersPanelProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setProviders(await providersApi.list());
  }

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  async function handleCreate() {
    if (!form.nome.trim()) {
      setError("Dê um nome ao provedor.");
      return;
    }
    setError(null);
    try {
      await providersApi.create({
        id: crypto.randomUUID(),
        tipo: form.tipo,
        nome: form.nome,
        baseUrl: form.baseUrl || undefined,
        apiKeyRef: form.apiKeyRef || undefined,
        model: form.model || undefined,
        cmd: form.cmd || undefined,
      });
      setForm(emptyForm);
      await reload();
      onChanged();
    } catch (err) {
      setError(humanizeApiError(err));
    }
  }

  async function handleTest(id: string) {
    setChecking(id);
    try {
      await providersApi.healthCheck(id);
    } finally {
      setChecking(null);
      await reload();
      onChanged();
    }
  }

  async function handleRemove(id: string) {
    await providersApi.remove(id);
    await reload();
    onChanged();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Hub de Provedores LLM"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: "var(--cor-fundo)",
        borderLeft: "1px solid var(--cor-borda)",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.08)",
        zIndex: 900,
        fontFamily: "var(--fonte-ui)",
        fontSize: 13,
        overflowY: "auto",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>Hub de Provedores LLM</strong>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}>
          ×
        </button>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: 16 }}>
        {providers.length === 0 && <li style={{ color: "var(--cor-texto-apagado)" }}>Nenhum provedor configurado ainda.</li>}
        {providers.map((p) => (
          <li
            key={p.id}
            style={{ border: "1px solid var(--cor-borda)", borderRadius: 6, padding: 8, marginBottom: 8 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{p.nome}</strong>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "#fff",
                  background: p.healthy === true ? "var(--cor-sucesso)" : p.healthy === false ? "var(--cor-erro)" : "var(--cor-texto-suave)",
                }}
              >
                {p.healthy === true ? "saudável" : p.healthy === false ? "com falha" : "não testado"}
              </span>
            </div>
            <div style={{ color: "var(--cor-texto-suave)", fontSize: 11, marginBottom: 6 }}>
              {p.tipo}
              {p.lastCheckedAt ? ` · testado em ${new Date(p.lastCheckedAt).toLocaleTimeString()}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => handleTest(p.id)} disabled={checking === p.id} style={{ padding: "2px 8px", cursor: "pointer" }}>
                {checking === p.id ? "Testando..." : "Testar conexão"}
              </button>
              <button type="button" onClick={() => handleRemove(p.id)} style={{ padding: "2px 8px", cursor: "pointer" }}>
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>

      <strong>Novo provedor</strong>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as ProviderType })}>
          {PROVIDER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span style={{ color: "var(--cor-texto-apagado)", fontSize: 11 }}>
          {PROVIDER_TYPES.find((t) => t.value === form.tipo)?.hint}
        </span>
        <input placeholder="Nome (ex.: Ollama local)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <input placeholder="baseUrl (opcional)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
        <input placeholder="apiKeyRef — nome da variável de ambiente (nunca a chave)" value={form.apiKeyRef} onChange={(e) => setForm({ ...form, apiKeyRef: e.target.value })} />
        <input placeholder="model (opcional)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        {form.tipo === "openai-codex" && (
          <input placeholder="cmd — binário do CLI (ex.: codex)" value={form.cmd} onChange={(e) => setForm({ ...form, cmd: e.target.value })} />
        )}
        {error && <span style={{ color: "var(--cor-erro)" }}>{error}</span>}
        <button type="button" onClick={handleCreate} style={{ padding: 6, cursor: "pointer" }}>
          Adicionar provedor
        </button>
      </div>
    </div>
  );
}
