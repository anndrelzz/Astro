import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PagamentoForm } from "@/front/cliente/pagamento-form";

// Tela 10 — forma de pagamento: cria o agendamento (RN05) e leva ao PIX ou a
// confirmacao. Com politica de acrescimo, o cliente ve o teto antes (RN01).

const roteador = { push: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador, useParams: () => ({ slug: "demo" }) }));

const BASE = {
  slug: "demo",
  servicoId: "serv-1",
  veiculoId: "vei-1",
  data: "2026-11-05",
  hora: "10:00",
  servico: { nome: "Lavação completa", duracaoMin: 120 },
  veiculo: { marca: "Chevrolet", modelo: "Astra", placa: "FDN8637", cor: "Prata" },
  segmento: "Hatch",
  preco: 70,
  cancelamentoHorasLimite: 2,
};

function respostaDaApi(status: number, corpo: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

async function clicar(nome: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: nome })[0]);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("PagamentoForm", () => {
  test("com PIX configurado, comeca no PIX e leva para a tela do codigo", async () => {
    const fetchMock = respostaDaApi(201, { id: "ag-1", status: "PIX_PENDENTE" });
    render(<PagamentoForm {...BASE} pixDisponivel acrescimoCondicaoPercent={null} />);

    await clicar("Continuar com PIX");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/agendamentos");
    expect(JSON.parse(init!.body as string)).toEqual({
      servicoId: "serv-1",
      veiculoId: "vei-1",
      data: "2026-11-05",
      hora: "10:00",
      formaPagamento: "PIX",
    });
    expect(roteador.push).toHaveBeenCalledWith("/demo/pagamento/ag-1");
  });

  test("sem chave PIX, nem oferece o PIX e confirma pagando no local (RN10)", async () => {
    const fetchMock = respostaDaApi(201, { id: "ag-2", status: "PENDENTE_PAGAMENTO" });
    render(<PagamentoForm {...BASE} pixDisponivel={false} acrescimoCondicaoPercent={null} />);

    expect(screen.queryByText("Pagar com PIX")).not.toBeInTheDocument();
    await clicar("Confirmar agendamento");

    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).formaPagamento).toBe("LOCAL");
    expect(roteador.push).toHaveBeenCalledWith("/demo/confirmado/ag-2");
  });

  test("com politica de acrescimo, mostra o aviso antes e so agenda ao concordar", async () => {
    const fetchMock = respostaDaApi(201, { id: "ag-3", status: "PENDENTE_PAGAMENTO" });
    render(<PagamentoForm {...BASE} pixDisponivel={false} acrescimoCondicaoPercent={30} />);

    await clicar("Confirmar agendamento");
    expect(fetchMock).not.toHaveBeenCalled();
    // O teto do aviso: R$ 70,00 + 30% = R$ 91,00.
    expect(screen.getAllByText(/91,00/).length).toBeGreaterThan(0);

    await clicar("Entendi, confirmar agendamento");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(roteador.push).toHaveBeenCalledWith("/demo/confirmado/ag-3");
  });

  test("horario tomado por outro cliente: mostra o motivo e fica na tela", async () => {
    respostaDaApi(409, { error: "Horario nao esta mais disponivel" });
    render(<PagamentoForm {...BASE} pixDisponivel={false} acrescimoCondicaoPercent={null} />);

    await clicar("Confirmar agendamento");

    expect(screen.getByText("Horario nao esta mais disponivel")).toBeInTheDocument();
    expect(roteador.push).not.toHaveBeenCalled();
  });
});
