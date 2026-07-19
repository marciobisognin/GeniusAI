import { useProviders } from "../providers/ProvidersContext.js";

export interface ProviderSelectProps {
  value?: string;
  onChange: (providerId: string | undefined) => void;
}

/** Seletor de provedor padrão de um Agente/Squad — lê do Hub de Provedores (Etapa 2). */
export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  const providers = useProviders();
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: 4, marginBottom: 4 }}
    >
      <option value="">(sem provedor — usa o padrão do sistema)</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome} {p.healthy === true ? "✓" : p.healthy === false ? "✗" : ""}
        </option>
      ))}
    </select>
  );
}
