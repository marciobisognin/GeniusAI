// ESLint flat config (RF-002/§14 do PRD — "lint" faltando no projeto).
// Cobre os 3 workspaces (backend, frontend, shared) com um único config na
// raiz. Usa as regras `recommended` (não type-aware) do typescript-eslint —
// mais rápida e sem exigir `parserOptions.project` apontando para os 3
// tsconfigs do monorepo; suficiente para pegar os erros reais mais comuns
// (variável não usada, import quebrado, hooks fora de ordem). Linting
// type-aware pode ser adicionado depois, se compensar o custo de CI.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/data/**",
      "**/logs/**",
      "apps/backend/src/agent/turn-demo.ts",
      "apps/backend/src/orchestrator/loop-demo.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend + shared: Node.js, ESM.
  {
    files: ["apps/backend/**/*.ts", "packages/shared/**/*.ts", "e2e/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Frontend: React + browser.
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Testes: mocks e stubs deliberadamente frouxos não devem gerar ruído.
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
