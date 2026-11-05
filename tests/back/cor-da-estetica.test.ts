import { describe, expect, test } from "vitest";
import { COR_PADRAO, cssDaCorDaEstetica } from "@/compartilhado/cor-da-estetica";

// RF13, UC12 — a cor que o Admin escolhe na Identidade visual vale em toda a
// pagina da estetica, inclusive nos pop-ups desenhados direto no <body>
// (aviso "Cadastre seu veiculo primeiro", pop-ups de Agendamentos e Perfil),
// que ficam fora da caixa do layout e saiam no azul padrao (bug de 05/11/2026).

describe("cssDaCorDaEstetica", () => {
  test("aplica a cor da estetica na pagina inteira (:root), com o tom claro derivado dela", () => {
    const css = cssDaCorDaEstetica("#e11d48");

    expect(css).toMatch(/^:root\{/);
    expect(css).toContain("--color-astro-blue:#e11d48");
    expect(css).toContain("--color-astro-blue-bright:color-mix(in srgb, #e11d48 80%, white 20%)");
  });

  test("sem cor configurada, usa o azul padrao do Astro", () => {
    expect(cssDaCorDaEstetica(null)).toContain(`--color-astro-blue:${COR_PADRAO}`);
  });

  test("valor fora do formato #RRGGBB nunca entra no CSS da pagina", () => {
    // A tela de Identidade ja so aceita #RRGGBB; isto e a segunda barreira,
    // porque o valor vai direto para dentro de uma tag <style>.
    for (const invalido of ["red", "#fff", "#e11d48;}body{display:none", "</style><script>alert(1)</script>"]) {
      const css = cssDaCorDaEstetica(invalido);
      expect(css).toContain(`--color-astro-blue:${COR_PADRAO}`);
      expect(css).not.toContain(invalido);
    }
  });
});
