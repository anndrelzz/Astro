import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EsperandoVoce } from "@/front/admin/esperando-voce";
import { JaFizOPagamento } from "@/front/cliente/ja-fiz-o-pagamento";

// "Ja fiz o pagamento" (PIX): o cliente avisa, o aviso fica registrado e o
// Admin ve no Dashboard quais PIX conferir primeiro.

const roteador = { refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));

afterEach(() => {
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("JaFizOPagamento (tela do PIX)", () => {
  test("avisa o servidor e leva para a confirmacao", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<JaFizOPagamento slug="demo" agendamentoId="ag-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Já fiz o pagamento" }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/agendamentos/ag-1/pagamento-informado", { method: "POST" });
    expect(roteador.push).toHaveBeenCalledWith("/demo/confirmado/ag-1");
  });

  test("se o aviso falhar, o cliente segue para a confirmacao do mesmo jeito", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem rede"));
    render(<JaFizOPagamento slug="demo" agendamentoId="ag-1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Já fiz o pagamento" }));
    });

    expect(roteador.push).toHaveBeenCalledWith("/demo/confirmado/ag-1");
  });
});

describe("EsperandoVoce (Dashboard)", () => {
  const item = {
    id: "ag-1",
    hora: "10:00",
    dia: "amanhã",
    cliente: "Maria Souza",
    detalhe: "Lavação completa · Civic · HND1234 · R$ 80,00",
  };

  test("mostra quando o cliente diz que ja pagou", () => {
    render(<EsperandoVoce itens={[{ ...item, informado: "Cliente diz que pagou às 14:32" }]} />);
    expect(screen.getByText("Cliente diz que pagou às 14:32")).toBeInTheDocument();
  });

  test("PIX sem aviso do cliente fica sem a linha", () => {
    render(<EsperandoVoce itens={[{ ...item, informado: null }]} />);
    expect(screen.queryByText(/diz que pagou/)).not.toBeInTheDocument();
  });
});
