// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Implementações síncronas (SQLite direto / fake em memória) de portas
    // intencionalmente assíncronas (AgendaPort/RelatorioPort — ver
    // src/conversation/ports.ts): o contrato é Promise<T> de propósito, pra
    // permitir trocar o backend sem tocar no router; nada aqui precisa de
    // await. Ao adicionar uma nova implementação síncrona de uma dessas
    // portas, inclua o arquivo nesta lista.
    files: [
      "src/db/agendaRepository.ts",
      "test/fakes/agendaPortFake.ts",
      "test/admin.test.ts",
      "scripts/smoke-e2e.ts",
    ],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
);
