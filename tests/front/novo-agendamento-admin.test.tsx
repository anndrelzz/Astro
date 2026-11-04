import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { NovoAgendamentoAdmin } from "@/front/admin/novo-agendamento-admin";

// O Admin agenda pelo cliente "coringa" quem chamou no WhatsApp ou no
// Instagram (decisoes de 04/11): so o tipo de veiculo e o modelo sao
// obrigatorios, a placa ja agendada antes preenche o resto, o preco sai da
// tabela e o pagamento e sempre no local.

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

const SERVICOS = [
  { id: "serv-lav", nome: "Lavagem completa", duracaoMin: 60, precos: { "seg-hatch": 60, "seg-suv": 90 } },
  { id: "serv-pol", nome: "Polimento", duracaoMin: 180, precos: { "seg-hatch": 350 } },
];
const SEGMENTOS = [
  { id: "seg-hatch", nome: "Hatch" },
  { id: "seg-suv", nome: "SUV" },
];
const VEICULOS_DO_CORINGA = [
  {
    id: "vei-1",
    placa: "FDN8637",
    marca: "Chevrolet",
    modelo: "Astra",
    segmentoId: "seg-hatch",
    contatoNome: "Carlos",
    contatoTelefone: "47988887777",
  },
];

function renderizar() {
  return render(
    <NovoAgendamentoAdmin
      tenantId="tenant-1"
      servicos={SERVICOS}
      segmentos={SEGMENTOS}
      veiculosDoCoringa={VEICULOS_DO_CORINGA}
      hoje="2026-11-04"
    />
  );
}

// /api/slots devolve os horarios; /api/admin/agendamentos, o resultado do envio.
function api(envio: { status: number; corpo: unknown } = { status: 201, corpo: { id: "ag-1" } }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (entrada) => {
    const url = String(entrada);
    if (url.startsWith("/api/slots")) {
      return new Response(JSON.stringify({ slots: ["09:00", "10:00"] }), { status: 200 });
    }
    return new Response(JSON.stringify(envio.corpo), { status: envio.status });
  });
}

async function abrir() {
  fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
}

function preencher(campos: Record<string, string>) {
  for (const [rotulo, valor] of Object.entries(campos)) {
    fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
  }
}

async function escolherDataEHora(data = "2026-11-10", hora = "10:00") {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: data } });
  });
  fireEvent.click(await screen.findByRole("button", { name: hora }));
}

async function agendar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
  });
}

describe("NovoAgendamentoAdmin", () => {
  test("busca os horarios com as regras do Admin e envia o agendamento", async () => {
    const fetchMock = api();
    renderizar();
    await abrir();

    preencher({ Modelo: "Civic", "Nome de quem chamou": "Joao", Telefone: "(47) 9 9999-0000" });
    await escolherDataEHora();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "/api/slots?tenantId=tenant-1&servicoId=serv-lav&data=2026-11-10&paraAdmin=1"
    );

    await agendar();

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/admin/agendamentos");
    expect(JSON.parse(init!.body as string)).toEqual({
      servicoId: "serv-lav",
      segmentoId: "seg-hatch",
      modelo: "Civic",
      placa: "",
      marca: "",
      ano: "",
      cor: "",
      data: "2026-11-10",
      hora: "10:00",
      contatoNome: "Joao",
      contatoTelefone: "(47) 9 9999-0000",
    });
    expect(roteador.refresh).toHaveBeenCalled();
  });

  test("mostra o preco do servico para o tipo de veiculo, pago no local", async () => {
    api();
    renderizar();
    await abrir();

    expect(screen.getByText("R$ 60,00 · pago no local")).toBeInTheDocument();
    preencher({ "Tipo de veículo": "seg-suv" });
    expect(screen.getByText("R$ 90,00 · pago no local")).toBeInTheDocument();
  });

  test("placa ja agendada antes preenche o carro e o ultimo contato", async () => {
    api();
    renderizar();
    await abrir();

    preencher({ Placa: "fdn-8637" });

    expect(screen.getByLabelText("Modelo")).toHaveValue("Astra");
    expect(screen.getByLabelText("Marca")).toHaveValue("Chevrolet");
    expect(screen.getByLabelText("Nome de quem chamou")).toHaveValue("Carlos");
    expect(screen.getByLabelText("Telefone")).toHaveValue("47988887777");
    expect(screen.getByText(/já foi agendado antes/)).toBeInTheDocument();
  });

  test("erro de um campo vindo da API aparece embaixo dele", async () => {
    const mensagem = "Telefone invalido - informe DDD + numero (10 ou 11 digitos)";
    api({ status: 400, corpo: { error: mensagem, campo: "contatoTelefone" } });
    renderizar();
    await abrir();

    preencher({ Modelo: "Civic", "Nome de quem chamou": "Joao", Telefone: "123" });
    await escolherDataEHora();
    await agendar();

    const telefone = screen.getByLabelText("Telefone");
    expect(telefone).toHaveAttribute("aria-invalid", "true");
    expect(telefone).toHaveAccessibleDescription(mensagem);
    expect(roteador.refresh).not.toHaveBeenCalled();
  });

  test("horario tomado no meio do caminho: mostra o motivo e nao fecha", async () => {
    api({ status: 409, corpo: { error: "Horario nao esta mais disponivel" } });
    renderizar();
    await abrir();

    preencher({ Modelo: "Civic", "Nome de quem chamou": "Joao", Telefone: "47999990000" });
    await escolherDataEHora();
    await agendar();

    expect(screen.getByText("Horario nao esta mais disponivel")).toBeInTheDocument();
    expect(roteador.refresh).not.toHaveBeenCalled();
  });
});
