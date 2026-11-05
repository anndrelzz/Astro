import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  bateComBusca,
  ClientesAdmin,
  resumoDoCliente,
  type ClienteDoPainel,
} from "@/front/admin/clientes-admin";

// Aba Clientes do painel (decisao do orientador, 30/10): quem ja se
// cadastrou, os carros e o historico de cada um, e quem sumiu.

// 04/11/2026, 12:00 de Brasilia.
const AGORA = "2026-11-04T15:00:00.000Z";
const AGORA_MS = new Date(AGORA).getTime();
const dias = (n: number) => new Date(AGORA_MS + n * 24 * 60 * 60 * 1000).toISOString();

type Agendamento = ClienteDoPainel["agendamentos"][number];

function agendamento(id: string, emDias: number, extra: Partial<Agendamento> = {}): Agendamento {
  return {
    id,
    dataISO: dias(emDias),
    fimISO: new Date(new Date(dias(emDias)).getTime() + 60 * 60 * 1000).toISOString(),
    servico: "Lavagem completa",
    placa: "FDN8637",
    status: emDias < 0 ? "CONFIRMADO" : "PENDENTE_PAGAMENTO",
    valor: 100,
    pago: emDias < 0,
    ...extra,
  };
}

function cliente(id: string, nome: string, extra: Partial<ClienteDoPainel> = {}): ClienteDoPainel {
  return {
    id,
    nome,
    email: `${id}@teste.com`,
    telefone: "47999990000",
    desdeISO: dias(-200),
    veiculos: [{ id: `v-${id}`, descricao: "Chevrolet Astra", placa: "FDN8637", segmento: "Hatch" }],
    agendamentos: [],
    ...extra,
  };
}

// O modal do celular usa o <dialog> nativo, que o jsdom nao implementa.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

describe("resumoDoCliente", () => {
  test("total pago soma so o que foi pago, sem os cancelados", () => {
    const c = cliente("c1", "Maria", {
      agendamentos: [
        agendamento("a3", 5, { pago: true, valor: 350 }),
        agendamento("a2", -10, { pago: true, valor: 136 }),
        agendamento("a1", -20, { pago: false, valor: 80 }),
        agendamento("a0", -30, { status: "CANCELADO", pago: true, valor: 999 }),
      ],
    });

    expect(resumoDoCliente(c, AGORA_MS).totalGasto).toBe(486);
  });

  test("proximo e o futuro mais perto de hoje; ultimo e o passado mais recente", () => {
    const c = cliente("c1", "Maria", {
      agendamentos: [agendamento("f2", 9), agendamento("f1", 2), agendamento("p1", -3), agendamento("p2", -40)],
    });

    const r = resumoDoCliente(c, AGORA_MS);
    expect(r.proximo?.id).toBe("f1");
    expect(r.ultimo?.id).toBe("p1");
    expect(r.agendamentos).toBe(4);
  });

  test("sem voltar: ultimo atendimento ha mais de 60 dias e nada marcado", () => {
    const sumido = cliente("c1", "Maria", { agendamentos: [agendamento("p", -61)] });
    const comProximo = cliente("c2", "Joao", { agendamentos: [agendamento("f", 3), agendamento("p", -61)] });
    const recente = cliente("c3", "Ana", { agendamentos: [agendamento("p", -59)] });

    expect(resumoDoCliente(sumido, AGORA_MS).sumido).toBe(true);
    expect(resumoDoCliente(comProximo, AGORA_MS).sumido).toBe(false);
    expect(resumoDoCliente(recente, AGORA_MS).sumido).toBe(false);
  });

  test("novo: cadastrou nos ultimos 30 dias", () => {
    expect(resumoDoCliente(cliente("c1", "Maria", { desdeISO: dias(-29) }), AGORA_MS).novo).toBe(true);
    expect(resumoDoCliente(cliente("c2", "Joao", { desdeISO: dias(-31) }), AGORA_MS).novo).toBe(false);
  });

  test("so com agendamento cancelado conta como quem nunca agendou", () => {
    const c = cliente("c1", "Maria", { agendamentos: [agendamento("a", -5, { status: "CANCELADO" })] });
    expect(resumoDoCliente(c, AGORA_MS).nunca).toBe(true);
  });
});

describe("bateComBusca", () => {
  const maria = cliente("c1", "João da Silva", { email: "joao@email.com", telefone: "47999990000" });

  test.each([
    ["sem acento", "joao"],
    ["pedaco do telefone, com pontuacao", "(47) 9 9999"],
    ["placa com hifen", "fdn-8637"],
    ["e-mail", "joao@email"],
    ["vazio mostra todos", "  "],
  ])("%s", (_caso, termo) => {
    expect(bateComBusca(maria, termo)).toBe(true);
  });

  test("termo que nao bate com nada", () => {
    expect(bateComBusca(maria, "pedro")).toBe(false);
  });
});

describe("ClientesAdmin", () => {
  const CLIENTES = [
    cliente("ana", "Ana Pereira"),
    cliente("joao", "João Lima", { agendamentos: [agendamento("j1", -80)] }),
    cliente("maria", "Maria Souza", {
      telefone: "47988887777",
      agendamentos: [agendamento("m2", 2), agendamento("m1", -10, { status: "CONFIRMADO", pago: true, valor: 350 })],
    }),
  ];

  const nomesNaLista = () =>
    within(screen.getByRole("region", { name: "Lista de clientes" }))
      .getAllByRole("button")
      .map((b) => b.textContent);

  test("ordena por quem esteve (ou vai estar) na loja mais perto de hoje", () => {
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);

    const nomes = nomesNaLista();
    expect(nomes[0]).toContain("Maria Souza");
    expect(nomes[1]).toContain("João Lima");
    expect(nomes[2]).toContain("Ana Pereira");
  });

  test("os filtros mostram so os clientes daquele grupo, com a contagem", () => {
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);

    fireEvent.click(screen.getByRole("button", { name: /Sem voltar/ }));
    expect(nomesNaLista()).toHaveLength(1);
    expect(nomesNaLista()[0]).toContain("João Lima");

    fireEvent.click(screen.getByRole("button", { name: /Nunca agendaram/ }));
    expect(nomesNaLista()[0]).toContain("Ana Pereira");
  });

  test("a busca filtra a lista, e sem resultado avisa", () => {
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);
    const busca = screen.getByRole("searchbox", { name: "Buscar cliente" });

    fireEvent.change(busca, { target: { value: "8888" } });
    expect(nomesNaLista()).toHaveLength(1);
    expect(nomesNaLista()[0]).toContain("Maria Souza");

    fireEvent.change(busca, { target: { value: "ninguem" } });
    expect(screen.getByText("Nenhum cliente encontrado com essa busca.")).toBeInTheDocument();
  });

  test("clicar num cliente mostra o detalhe: WhatsApp, total pago, garagem e agendamentos", () => {
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);

    fireEvent.click(screen.getAllByRole("button", { name: /João Lima/ })[0]);

    const detalhe = screen.getAllByRole("region", { name: "Detalhes de João Lima" })[0];
    expect(within(detalhe).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/5547999990000"
    );
    expect(within(detalhe).getByText("R$ 100,00")).toBeInTheDocument();
    expect(within(detalhe).getByText("FDN8637")).toBeInTheDocument();
    // Ativo com o horario ja passado aparece como concluido, como na agenda.
    expect(within(detalhe).getByText("Concluído")).toBeInTheDocument();
  });

  test("sem nenhum cliente, explica quando a lista vai ter alguem", () => {
    render(<ClientesAdmin clientes={[]} agoraISO={AGORA} />);
    expect(screen.getByText("Quando alguém criar conta na sua estética, aparece aqui.")).toBeInTheDocument();
  });
});

describe("ClientesAdmin — agendados pelo Admin", () => {
  const CONTATOS = [
    {
      telefone: "47988887777",
      nome: "Joao do WhatsApp",
      agendamentos: 2,
      ultimoISO: dias(-3),
      proximoISO: dias(4),
      carros: ["Civic · QWE1R23"],
    },
    { telefone: "47911112222", nome: "Ana do Instagram", agendamentos: 1, ultimoISO: dias(-40), proximoISO: null, carros: ["Onix"] },
  ];

  test("ficam num bloco separado, com o carro e o WhatsApp de quem chamou", () => {
    render(<ClientesAdmin clientes={[cliente("maria", "Maria Souza")]} contatosDoAdmin={CONTATOS} agoraISO={AGORA} />);

    const bloco = screen.getByRole("region", { name: "Agendado pelo Admin" });
    expect(within(bloco).getByText("Joao do WhatsApp")).toBeInTheDocument();
    expect(within(bloco).getByText(/Civic · QWE1R23/)).toBeInTheDocument();
    expect(within(bloco).getAllByRole("link", { name: /WhatsApp/ })[0]).toHaveAttribute(
      "href",
      "https://wa.me/5547988887777"
    );
    // Nao se misturam com os clientes que tem conta.
    expect(nomesDaLista()).toEqual([expect.stringContaining("Maria Souza")]);
  });

  test("a busca tambem procura neles", () => {
    render(<ClientesAdmin clientes={[]} contatosDoAdmin={CONTATOS} agoraISO={AGORA} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar cliente" }), { target: { value: "qwe-1r23" } });

    const bloco = screen.getByRole("region", { name: "Agendado pelo Admin" });
    expect(within(bloco).getByText("Joao do WhatsApp")).toBeInTheDocument();
    expect(within(bloco).queryByText("Ana do Instagram")).not.toBeInTheDocument();
  });

  test("sem ninguem agendado pelo Admin, o bloco nao aparece", () => {
    render(<ClientesAdmin clientes={[cliente("maria", "Maria Souza")]} contatosDoAdmin={[]} agoraISO={AGORA} />);
    expect(screen.queryByRole("region", { name: "Agendado pelo Admin" })).not.toBeInTheDocument();
  });
});

// O detalhe aparece de um jeito em cada tela: no computador, no painel ao lado
// da lista; no celular, num modal. O modal nativo deixa o resto da pagina
// inerte enquanto esta aberto — se ele abrir no computador, onde fica
// escondido, a pagina parece travada e so sai com F5 (bug de 05/11/2026).
describe("ClientesAdmin — modal so no celular", () => {
  const CLIENTES = [cliente("ana", "Ana Pereira"), cliente("joao", "João Lima")];
  let telaDeComputador = false;
  let avisarMudanca: ((e: { matches: boolean }) => void) | null = null;

  beforeEach(() => {
    avisarMudanca = null;
    window.matchMedia = vi.fn((consulta: string) => ({
      matches: telaDeComputador,
      media: consulta,
      onchange: null,
      addEventListener: (_tipo: string, ouvinte: (e: { matches: boolean }) => void) => {
        avisarMudanca = ouvinte;
      },
      removeEventListener: () => {
        avisarMudanca = null;
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  const modalAberto = () => document.querySelector("dialog")?.open ?? false;

  test("no computador, clicar num cliente nao abre o modal escondido", () => {
    telaDeComputador = true;
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);

    fireEvent.click(screen.getAllByRole("button", { name: /João Lima/ })[0]);

    expect(modalAberto()).toBe(false);
  });

  test("no celular, clicar num cliente abre o modal", () => {
    telaDeComputador = false;
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);

    fireEvent.click(screen.getAllByRole("button", { name: /João Lima/ })[0]);

    expect(modalAberto()).toBe(true);
  });

  test("se a tela cresce para computador com o modal aberto, ele fecha", () => {
    telaDeComputador = false;
    render(<ClientesAdmin clientes={CLIENTES} agoraISO={AGORA} />);
    fireEvent.click(screen.getAllByRole("button", { name: /João Lima/ })[0]);
    expect(modalAberto()).toBe(true);

    act(() => avisarMudanca?.({ matches: true }));

    expect(modalAberto()).toBe(false);
  });
});

const nomesDaLista = () =>
  within(screen.getByRole("region", { name: "Lista de clientes" }))
    .getAllByRole("button")
    .map((b) => b.textContent);
