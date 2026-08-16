#!/usr/bin/env node
import { startStdioServer } from "./server.js";

/**
 * Ponto de entrada do servidor MCP (transporte stdio).
 *
 * Nada pode ser escrito em stdout além do protocolo JSON-RPC — por isso os
 * diagnósticos vão para stderr.
 */
startStdioServer().catch((error: unknown) => {
  console.error("[genius-mcp-organograma] falha ao iniciar:", error);
  process.exit(1);
});
