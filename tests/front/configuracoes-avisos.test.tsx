import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ConfiguracoesAdmin } from "@/front/admin/configuracoes-admin";

// Configuracoes: o dono liga ou desliga os e-mails de aviso (novo agendamento,
// PIX aguardando confirmacao e cancelamento). Ligado por padrao.

const roteador = { refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));

beforeAll(() => {
  // A tela marca a secao visivel no menu lateral; o jsdom nao tem o observador.
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const CONFIG = {
  nome: "Estetica Demo",
  descricao: "",
  telefone: "",
  whatsapp: "47999990000",
  emailContato: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  pixChaveCopiaCola: "",
  acrescimoCondicaoPercent: null,
  cancelamentoHorasLimite: 2,
  avisosPorEmail: true,
};

describe("Configuracoes — avisos por e-mail ao dono", () => {
  test("vem ligado e, desligando, salva avisosPorEmail = false", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<ConfiguracoesAdmin slug="demo" configInicial={CONFIG} />);

    const chave = screen.getByRole("switch", { name: /Receber um e-mail a cada novo agendamento e cancelamento/ });
    expect(chave).toHaveAttribute("aria-checked", "true");

    fireEvent.click(chave);
    expect(chave).toHaveAttribute("aria-checked", "false");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ avisosPorEmail: false });
  });
});
