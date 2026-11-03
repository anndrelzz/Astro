import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NovoVeiculoForm } from "@/front/cliente/novo-veiculo-form";

// UC02, tela 08 — cadastro de veiculo. RN04: quem chegou aqui pelo "Agendar"
// volta para o agendamento daquele servico depois de salvar.

const roteador = { back: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
let callbackUrl: string | null = null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "demo" }),
  useRouter: () => roteador,
  useSearchParams: () => new URLSearchParams(callbackUrl ? { callbackUrl } : {}),
}));
// A fonte da placa vem do next/font, que so existe dentro do Next.
vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "fonte-placa" }) }));

const SEGMENTOS = [
  { id: "seg-hatch", nome: "Hatch" },
  { id: "seg-suv", nome: "SUV" },
];

function respostaDaApi(status: number, corpo: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status }));
}

function preencher() {
  fireEvent.change(screen.getByPlaceholderText("Ex: Jeep"), { target: { value: "Chevrolet" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Compass Limited"), { target: { value: "Astra" } });
  fireEvent.change(screen.getByLabelText("Placa do veículo"), { target: { value: "FDN8637" } });
  fireEvent.change(screen.getByPlaceholderText("2023"), { target: { value: "2010" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Preto Carbon"), { target: { value: "Prata" } });
}

async function salvar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar veículo" }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  callbackUrl = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const f of Object.values(roteador)) f.mockReset();
});

describe("NovoVeiculoForm", () => {
  test("ao salvar, confirma o carro cadastrado antes de sair da tela", async () => {
    vi.stubGlobal("fetch", respostaDaApi(201, { id: "v1" }));
    callbackUrl = "/demo/agendar/serv-1";
    render(<NovoVeiculoForm segmentos={SEGMENTOS} />);

    preencher();
    await salvar();

    expect(screen.getByText("Carro cadastrado!")).toBeInTheDocument();
    expect(screen.getByText("Chevrolet Astra · Hatch")).toBeInTheDocument();
    // Ainda na confirmacao: a troca de tela nao e instantanea.
    expect(roteador.push).not.toHaveBeenCalled();
  });

  test("tela cheia: depois da confirmacao, vai para o agendamento do servico", async () => {
    vi.stubGlobal("fetch", respostaDaApi(201, { id: "v1" }));
    callbackUrl = "/demo/agendar/serv-1";
    render(<NovoVeiculoForm segmentos={SEGMENTOS} />);

    preencher();
    await salvar();
    act(() => vi.advanceTimersByTime(1000));

    expect(roteador.push).toHaveBeenCalledWith("/demo/agendar/serv-1");
  });

  test("no pop-up vindo de um servico: fecha o pop-up e entao abre o agendamento", async () => {
    vi.stubGlobal("fetch", respostaDaApi(201, { id: "v1" }));
    callbackUrl = "/demo/agendar/serv-1";
    const { unmount } = render(<NovoVeiculoForm emModal segmentos={SEGMENTOS} />);

    preencher();
    await salvar();
    act(() => vi.advanceTimersByTime(1000));

    // Primeiro desfaz a navegacao que abriu o pop-up (so assim ele fecha)...
    expect(roteador.back).toHaveBeenCalledTimes(1);
    expect(roteador.push).not.toHaveBeenCalled();

    // ...e so depois que o navegador voltou, segue para o agendamento. No
    // navegador, o Next trata o popstate primeiro e fecha o pop-up na hora:
    // o formulario sai da tela ANTES de o evento chegar ao ouvinte dele.
    unmount();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(50);
    });
    expect(roteador.push).toHaveBeenCalledWith("/demo/agendar/serv-1");
  });

  test("no pop-up aberto da propria pagina: so fecha, sem navegar", async () => {
    vi.stubGlobal("fetch", respostaDaApi(201, { id: "v1" }));
    callbackUrl = "/demo";
    render(<NovoVeiculoForm emModal segmentos={SEGMENTOS} />);

    preencher();
    await salvar();
    act(() => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(50);
    });

    expect(roteador.back).toHaveBeenCalledTimes(1);
    expect(roteador.push).not.toHaveBeenCalled();
  });

  test("callbackUrl de fora da estetica e ignorado: volta para a home dela", async () => {
    vi.stubGlobal("fetch", respostaDaApi(201, { id: "v1" }));
    callbackUrl = "//site-malicioso.com";
    render(<NovoVeiculoForm segmentos={SEGMENTOS} />);

    preencher();
    await salvar();
    act(() => vi.advanceTimersByTime(1000));

    expect(roteador.push).toHaveBeenCalledWith("/demo");
  });

  test("se a API recusar, mostra o erro e nao confirma nada", async () => {
    vi.stubGlobal("fetch", respostaDaApi(409, { error: "Voce ja tem esse veiculo cadastrado" }));
    callbackUrl = "/demo/agendar/serv-1";
    render(<NovoVeiculoForm segmentos={SEGMENTOS} />);

    preencher();
    await salvar();
    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText("Voce ja tem esse veiculo cadastrado")).toBeInTheDocument();
    expect(screen.queryByText("Carro cadastrado!")).not.toBeInTheDocument();
    expect(roteador.push).not.toHaveBeenCalled();
    expect(roteador.back).not.toHaveBeenCalled();
  });
});
