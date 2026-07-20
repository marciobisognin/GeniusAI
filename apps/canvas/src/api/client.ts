const BASE_URL = import.meta.env.VITE_CONSTRUCTOR_URL ?? "http://127.0.0.1:4001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Só declara Content-Type: application/json quando há corpo de verdade —
  // Fastify rejeita (400) um POST com esse header e corpo vazio.
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Converte um erro de API em texto legível para o usuário: extrai o
 * `detail` do JSON do servidor quando houver, em vez de mostrar
 * `POST /x -> 400: {"error":...}` cru na interface.
 */
export function humanizeApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(raw.slice(jsonStart)) as { detail?: string; error?: string };
      if (body.detail) return body.detail;
      if (body.error) return `Erro do servidor: ${body.error}`;
    } catch {
      // corpo não era JSON — cai para o texto bruto abaixo
    }
  }
  return raw;
}

/** Cliente REST fino para o Super Construtor (`@genius/constructor`). */
export const apiClient = {
  list: <T>(path: string) => request<T[]>(`/${path}`),
  get: <T>(path: string, id: string) => request<T>(`/${path}/${id}`),
  create: <T>(path: string, body: unknown) =>
    request<T>(`/${path}`, { method: "POST", body: JSON.stringify(body) }),
  update: <T>(path: string, id: string, patch: unknown) =>
    request<T>(`/${path}/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (path: string, id: string) => request<void>(`/${path}/${id}`, { method: "DELETE" }),
  health: () => request<{ status: string }>("/health"),
};
