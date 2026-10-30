import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Configuracao dos testes (Vitest).
//
// `npm test` roda todos os testes; `npm run test:cobertura` roda os mesmos e
// gera o relatorio de cobertura em coverage/ (abrir coverage/index.html).
//
// Variaveis de ambiente: lidas do .env da raiz, como o `next dev`. Os testes
// de RLS e das rotas da API (tests/back/rotas) precisam do DATABASE_URL apontando
// para um banco com as migrations aplicadas, conectado com o role da
// aplicacao. Eles criam esteticas de teste proprias e as apagam no fim.
// No CI nao ha .env: as variaveis vem do proprio workflow.
export default defineConfig(({ mode }) => ({
  resolve: {
    // Mesmo atalho do tsconfig.json ("@/*" -> "./src/*").
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
    },
  },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    // Os testes de RLS criam e apagam duas esteticas inteiras no banco.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    // Um projeto por lado do sistema, cada um com o seu ambiente:
    // `npm run test:back` roda so o backend e `npm run test:front` so o front,
    // que roda num navegador simulado (jsdom).
    projects: [
      {
        extends: true,
        test: {
          name: "back",
          include: ["tests/back/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "front",
          include: ["tests/front/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/front/preparar.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Backend: servidor (src/back), regras puras (src/compartilhado), rotas
      // da API e o proxy. Front: os componentes de tela (src/front). As
      // paginas (page.tsx) ficam de fora: sao cobertas pelo E2E.
      include: [
        "src/back/**/*.ts",
        "src/compartilhado/**/*.ts",
        "src/app/api/**/*.ts",
        "src/proxy.ts",
        "src/front/**/*.tsx",
      ],
      // text: tabela no terminal; html: relatorio navegavel; lcov: formato
      // lido por ferramentas como o SonarQube Cloud.
      reporter: ["text", "html", "lcov"],
    },
  },
}));
