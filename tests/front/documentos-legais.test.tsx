import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PrivacidadePage from "@/app/privacidade/page";
import TermosPage from "@/app/termos/page";

// LGPD (RNF08): o cadastro pede para aceitar os Termos de uso e a Politica de
// privacidade, entao os dois textos precisam existir. Versao academica, sem
// revisao juridica, e a pagina diz isso.

describe("Politica de privacidade (/privacidade)", () => {
  test("avisa que e uma versao academica, sem revisao juridica", () => {
    render(<PrivacidadePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeInTheDocument();
    expect(screen.getByText(/Versão acadêmica, sem revisão jurídica/)).toBeInTheDocument();
  });

  test("diz quais dados o Astro coleta, inclusive os do carro", () => {
    render(<PrivacidadePage />);
    const secao = screen.getByRole("region", { name: "Quais dados coletamos" });
    for (const dado of ["Nome", "E-mail", "Telefone", "placa"]) {
      expect(within(secao).getAllByText(new RegExp(dado)).length).toBeGreaterThan(0);
    }
  });

  test("diz com quem os dados sao compartilhados", () => {
    render(<PrivacidadePage />);
    const secao = screen.getByRole("region", { name: "Com quem compartilhamos" });
    for (const empresa of ["Microsoft Azure", "Resend", "Telegram", "Grafana"]) {
      expect(within(secao).getByText(new RegExp(empresa))).toBeInTheDocument();
    }
  });

  test("lista os direitos do titular (art. 18 da LGPD)", () => {
    render(<PrivacidadePage />);
    const secao = screen.getByRole("region", { name: "Seus direitos" });
    expect(within(secao).getByText(/art\. 18/)).toBeInTheDocument();
    expect(within(secao).getByText(/Corrigir/)).toBeInTheDocument();
    expect(within(secao).getByText(/eliminação/)).toBeInTheDocument();
  });
});

describe("Termos de uso (/termos)", () => {
  test("avisa que e uma versao academica e aponta para a politica de privacidade", () => {
    render(<TermosPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeInTheDocument();
    expect(screen.getByText(/Versão acadêmica, sem revisão jurídica/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Política de privacidade/ })[0]).toHaveAttribute("href", "/privacidade");
  });

  test("diz que o pagamento do servico e combinado com a estetica", () => {
    render(<TermosPage />);
    expect(screen.getByRole("region", { name: "Pagamentos" })).toHaveTextContent(/diretamente à estética/);
  });
});
