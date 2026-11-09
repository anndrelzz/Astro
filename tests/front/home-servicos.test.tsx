import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { HomeServicos } from "@/front/cliente/home-servicos";

// Tela 06 — servicos da home. RN04: logado sem veiculo cai no aviso "sem
// veiculo" ao tocar num servico, e o cadastro leva de volta a ele.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));

const SERVICOS = [
  { id: "serv-1", nome: "Lavagem completa", descricao: null, duracaoMin: 120, precos: { "seg-hatch": 70 } },
  { id: "serv-2", nome: "Polimento", descricao: null, duracaoMin: 180, precos: { "seg-hatch": 350 } },
];

describe("HomeServicos sem veiculo", () => {
  test("o aviso leva ao cadastro com o servico escolhido como destino", () => {
    render(<HomeServicos slug="demo" servicos={SERVICOS} carro={null} logado temVeiculo={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Agendar Polimento" }));

    const link = screen.getByRole("link", { name: /Cadastrar veículo/ });
    const destino = new URL(link.getAttribute("href")!, "http://localhost");
    expect(destino.pathname).toBe("/demo/veiculos/novo");
    expect(destino.searchParams.get("callbackUrl")).toBe("/demo/agendar/serv-2");
  });

  test("cada servico leva ao seu proprio agendamento", () => {
    render(<HomeServicos slug="demo" servicos={SERVICOS} carro={null} logado temVeiculo={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Agendar Lavagem completa" }));
    const link = screen.getByRole("link", { name: /Cadastrar veículo/ });

    expect(new URL(link.getAttribute("href")!, "http://localhost").searchParams.get("callbackUrl")).toBe(
      "/demo/agendar/serv-1"
    );
  });
});
