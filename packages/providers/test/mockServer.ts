import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockServer {
  url: string;
  requests: Array<{ method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string }>;
  close: () => Promise<void>;
}

/** Servidor HTTP real (não mock de biblioteca) para testar os adapters sem depender de rede externa nem de credenciais reais. */
export function startMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void,
): Promise<MockServer> {
  const requests: MockServer["requests"] = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        requests.push({ method: req.method, url: req.url, headers: req.headers, body });
        handler(req, res, body);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
