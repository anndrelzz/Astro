import { describe, expect, test } from "vitest";
import nextConfig from "../../next.config";

// OWASP A05 (configuracao insegura): os cabecalhos que o Astro manda em toda
// resposta. Conferidos aqui para nenhum sumir sem alguem perceber.

async function cabecalhos() {
  const regras = await nextConfig.headers!();
  const todas = regras.find((regra) => regra.source === "/:path*");
  return Object.fromEntries((todas?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe("cabecalhos de seguranca", () => {
  test("nao anuncia a tecnologia do servidor (sem X-Powered-By: Next.js)", () => {
    // O cabecalho so ajuda um atacante a saber o que procurar.
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  test("toda resposta leva os cabecalhos de seguranca", async () => {
    expect(await cabecalhos()).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
  });
});
