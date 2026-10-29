import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Configuracao dos testes (Vitest).
//
// `npm test` roda todos os testes; `npm run test:cobertura` roda os mesmos e
// gera o relatorio de cobertura em coverage/ (abrir coverage/index.html).
//
// Variaveis de ambiente: lidas do .env da raiz, como o `next dev`. Os testes
// de RLS precisam do DATABASE_URL apontando para um banco com as migrations
// aplicadas, conectado com o role da aplicacao (ver tests/rls-isolamento).
// No CI nao ha .env: as variaveis vem do proprio workflow.
export default defineConfig(({ mode }) => ({
  resolve: {
    // Mesmo atalho do tsconfig.json ("@/*" -> "./src/*").
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    // Os testes de RLS criam e apagam duas esteticas inteiras no banco.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    // Um projeto por lado do sistema, cada um com o seu ambiente:
    // `npm run test:back` roda so o backend. O front entra como segundo
    // projeto, com um navegador simulado (jsdom).
    projects: [
      {
        extends: true,
        test: {
          name: "back",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Codigo gerado pelo `prisma generate`, nao escrito por nos.
      exclude: ["src/generated/**"],
      // text: tabela no terminal; html: relatorio navegavel; lcov: formato
      // lido por ferramentas como o SonarQube Cloud.
      reporter: ["text", "html", "lcov"],
    },
  },
}));
