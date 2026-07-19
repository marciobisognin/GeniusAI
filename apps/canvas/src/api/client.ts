const BASE_URL = import.meta.env.VITE_CONSTRUCTOR_URL ?? "http://127.0.0.1:4001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
