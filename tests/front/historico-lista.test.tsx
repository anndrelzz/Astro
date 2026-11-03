import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HistoricoLista } from "@/front/cliente/historico-lista";

// UC05, tela 13 — "Meus agendamentos": a lista por categoria e o cancelamento
// dentro da janela da estetica (RN11).

const roteador = { refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => roteador,
  useParams: () => ({ slug: "demo" }),
}));

// Terca, 03/11/2026, 12:00 em Brasilia.
const AGORA = new Date("2026-11-03T15:00:00Z");
const daqui = (horas: number) => new Date(AGORA.getTime() + horas * 3600_000).toISOString();

const item = (id: string, servicoNome: string, horas: number, status = "PENDENTE_PAGAMENTO") => ({
  id,
  dataHoraISO: daqui(horas),
  duracaoMin: 60,
  servicoNome,
  veiculoMarcaModelo: "Chevrolet Astra",
  placa: "FDN8637",
  segmento: "Hatch",
  valor: 70,
  acrescimoAplicado: null,
  status,
  formaPagamento: "LOCAL",
});

const ITENS = [
  item("a1", "Polimento", 72), // daqui a 3 dias: proximo, cancelavel
  item("a2", "Lavagem rapida", 2), // daqui a 2 h: proximo, fora da janela de 24 h
  item("a3", "Higienizacao", -48, "CONFIRMADO"), // ja passou: concluido
  item("a4", "Vitrificacao", 24 * 5, "CANCELADO"), // cancelado
];

// A lista desenha cartoes (celular) e tabela (desktop) ao mesmo tempo; o CSS
// esconde um dos dois. Por isso as buscas contam pelo menos uma ocorrencia.
const aparece = (texto: string) => screen.queryAllByText(texto).length > 0;

function renderizar() {
  return render(<HistoricoLista itens={ITENS} horasLimite={24} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("HistoricoLista — categorias", () => {
  test("abre em Proximos, so com o que ainda vai acontecer", () => {
    renderizar();

    expect(aparece("Polimento")).toBe(true);
    expect(aparece("Lavagem rapida")).toBe(true);
    expect(aparece("Higienizacao")).toBe(false);
    expect(aparece("Vitrificacao")).toBe(false);
  });

  test("agendamento ativo cujo horario ja passou aparece em Concluidos", () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: /Concluídos/ }));

    expect(aparece("Higienizacao")).toBe(true);
    expect(aparece("Polimento")).toBe(false);
  });

  test("Cancelados e Todos filtram pela categoria", () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelados/ }));
    expect(aparece("Vitrificacao")).toBe(true);
    expect(aparece("Polimento")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    for (const nome of ["Polimento", "Lavagem rapida", "Higienizacao", "Vitrificacao"]) {
      expect(aparece(nome)).toBe(true);
    }
  });

  test("sem nada na categoria, avisa que esta vazia", () => {
    render(<HistoricoLista itens={[ITENS[2]]} horasLimite={24} />);

    expect(screen.getAllByText("Nenhum agendamento aqui.").length).toBeGreaterThan(0);
  });
});

describe("HistoricoLista — cancelamento (RN11)", () => {
  test("so oferece cancelar o que esta fora da janela de antecedencia", () => {
    renderizar();

    expect(screen.queryAllByRole("button", { name: "Cancelar Polimento" }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: "Cancelar Lavagem rapida" })).toHaveLength(0);
  });

  test("confirmando, chama a API e atualiza a tela", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    renderizar();

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar Polimento" })[0]);
    expect(screen.getByText(/Tem certeza que deseja cancelar o serviço de/)).toHaveTextContent("Polimento");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar agendamento" }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/agendamentos/a1/cancelar", { method: "POST" });
    expect(roteador.refresh).toHaveBeenCalled();
    expect(screen.queryByText("Cancelar agendamento?")).not.toBeInTheDocument();
  });

  test("se a API recusar, mostra o motivo e mantem o modal aberto", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Fora do prazo de cancelamento" }), { status: 403 })
    );
    renderizar();

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar Polimento" })[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar agendamento" }));
    });

    expect(screen.getByText("Fora do prazo de cancelamento")).toBeInTheDocument();
    expect(screen.getByText("Cancelar agendamento?")).toBeInTheDocument();
    expect(roteador.refresh).not.toHaveBeenCalled();
  });

  test("Manter agendamento fecha o modal sem chamar a API", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderizar();

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar Polimento" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Manter agendamento" }));

    expect(screen.queryByText("Cancelar agendamento?")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
