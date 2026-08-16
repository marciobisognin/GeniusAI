#!/usr/bin/env node
import { startStdioServer } from "./server.js";

startStdioServer().catch((error: unknown) => {
  console.error("[genius-mcp-ensaio] falha ao iniciar:", error);
  process.exit(1);
});
