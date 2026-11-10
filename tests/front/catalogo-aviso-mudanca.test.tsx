import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { CatalogoAdmin } from "@/front/admin/catalogo-admin";

// Mudar a duracao ou o preco de um servico vale so para os proximos
// agendamentos: os ja marcados continuam como foram feitos. Antes de salvar,
// o Catalogo avisa isso num segundo pop-up, com "Voltar" e "Salvar mesmo
// assim" (decisao do Andre, 10/11): o dono confirma duas vezes e sabe o que
// esta mudando.

const roteador = { refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));

// O modal do painel usa o <dialog> nativo, que o jsdom nao implementa.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

const SEGMENTOS = [{ id: "seg-hatch", nome: "Hatch", ordem: 0 }];
const SERVICOS = [
  {
    id: "serv-lav",
    nome: "Lavação completa",
    descricao: null,
    ativo: true,
    duracaoMin: 60,
    precos: { "seg-hatch": 80 },
  },
];

const TITULO_DO_AVISO = "Essa mudança vale para os próximos agendamentos";

function abrirServico() {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  render(<CatalogoAdmin segmentos={SEGMENTOS} servicos={SERVICOS} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Lavação completa" }));
  return fetchMock;
}

async function clicar(nome: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("Catalogo — aviso antes de mudar duracao ou preco", () => {
  test("aumentar a duracao abre o aviso e nao salva ainda", async () => {
    const fetchMock = abrirServico();
    fireEvent.click(screen.getByRole("button", { name: "2h" }));
    await clicar("Salvar");

    const aviso = screen.getByRole("alertdialog", { name: TITULO_DO_AVISO });
    expect(within(aviso).getByText(/Duração: 1h → 2h/)).toBeInTheDocument();
    expect(
      within(aviso).getByText(/Os agendamentos já marcados continuam com a duração e o preço de quando foram feitos/)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("mudar o preco tambem avisa, com o tipo de veiculo e os dois valores", async () => {
    abrirServico();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "90" } });
    await clicar("Salvar");

    const aviso = screen.getByRole("alertdialog", { name: TITULO_DO_AVISO });
    expect(within(aviso).getByText(/Preço \(Hatch\): R\$ 80,00 → R\$ 90,00/)).toBeInTheDocument();
  });

  test("Voltar fecha o aviso sem salvar e deixa o servico aberto para revisar", async () => {
    const fetchMock = abrirServico();
    fireEvent.click(screen.getByRole("button", { name: "2h" }));
    await clicar("Salvar");
    await clicar("Voltar");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2h" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Salvar mesmo assim grava a mudanca", async () => {
    const fetchMock = abrirServico();
    fireEvent.click(screen.getByRole("button", { name: "2h" }));
    await clicar("Salvar");
    await clicar("Salvar mesmo assim");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/servicos/serv-lav");
    expect(init!.method).toBe("PATCH");
    expect(JSON.parse(init!.body as string)).toMatchObject({ duracaoMin: 120 });
  });

  test("mudar so o nome salva direto, sem aviso", async () => {
    const fetchMock = abrirServico();
    fireEvent.change(screen.getByDisplayValue("Lavação completa"), { target: { value: "Lavação premium" } });
    await clicar("Salvar");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("servico novo salva direto: ainda nao tem agendamento nenhum", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<CatalogoAdmin segmentos={SEGMENTOS} servicos={SERVICOS} />);
    // O topo e a lista vazia tem cada um o seu botao; qualquer um abre o mesmo pop-up.
    fireEvent.click(screen.getAllByRole("button", { name: /Novo serviço/ })[0]);
    fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Polimento" } });
    fireEvent.click(screen.getByRole("button", { name: "2h" }));
    await clicar("Salvar");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/servicos");
  });
});
