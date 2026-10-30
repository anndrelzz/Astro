import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { POST as agendar } from "@/app/api/agendamentos/route";
import { POST as cancelar } from "@/app/api/agendamentos/[id]/cancelar/route";
import { POST as confirmarPagamento } from "@/app/api/agendamentos/[id]/confirmar-pagamento/route";
import { GET as consultarSlots } from "@/app/api/slots/route";
import type { StatusAgendamento } from "@/generated/prisma/enums";
import { instanteNoFuso } from "@/compartilhado/fuso";
import { enviarEmail } from "@/back/notificacoes/email";
import { prisma } from "@/back/prisma";
import { travarDiaParaAgendamento } from "@/back/slots";
import { withTenant } from "@/back/tenant-db";
import { comId, criarEstetica, daqui, diaDaqui, entrarComo, pedido, removerEstetica, type Estetica } from "./ajudantes";

// UC03 a UC06, UC16 — o ciclo do agendamento: ver horarios livres, agendar,
// cancelar e confirmar o pagamento. Banco real; a sessao e o envio de e-mail e
// Telegram sao substituidos.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
// O after() do Next so funciona dentro de uma requisicao de verdade. Aqui ele
// guarda o que a rota mandaria fazer depois da resposta, e o teste roda essas
// tarefas quando quiser, com depoisDaResposta().
const { tarefasDepois } = vi.hoisted(() => ({ tarefasDepois: [] as (() => unknown)[] }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (tarefa: () => unknown) => {
    tarefasDepois.push(tarefa);
  },
}));
async function depoisDaResposta() {
  for (const tarefa of tarefasDepois.splice(0)) await tarefa();
}
vi.mock("@/back/notificacoes/email", () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));
vi.mock("@/back/notificacoes/telegram", () => ({
  enviarTelegram: vi.fn(async () => ({ enviado: true, modo: "log" })),
}));

let e: Estetica;

beforeAll(async () => {
  e = await criarEstetica("agendamentos");
});

afterAll(async () => {
  await removerEstetica(e.tenant.slug);
  await prisma.$disconnect();
});

// Agendamento gravado direto no banco, para os testes de cancelar e confirmar.
function agendamentoNoBanco(dataHora: Date, status: StatusAgendamento = "PENDENTE_PAGAMENTO", usuarioId?: string) {
  return withTenant(e.tenant.id, (tx) =>
    tx.agendamento.create({
      data: {
        tenantId: e.tenant.id,
        usuarioId: usuarioId ?? e.cliente.id,
        veiculoId: e.veiculo.id,
        servicoId: e.servico.id,
        dataHora,
        formaPagamento: "LOCAL",
        status,
        valor: 80,
      },
    })
  );
}

const buscar = (id: string) =>
  withTenant(e.tenant.id, (tx) =>
    tx.agendamento.findUnique({ where: { id }, include: { notificacoes: true } })
  );

describe("POST /api/agendamentos", () => {
  const corpo = (dias: number, extra: Record<string, unknown> = {}) => ({
    servicoId: e.servico.id,
    veiculoId: e.veiculo.id,
    data: diaDaqui(dias),
    hora: "10:00",
    formaPagamento: "LOCAL",
    ...extra,
  });

  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await agendar(pedido("POST", "/api/agendamentos", corpo(3)))).status).toBe(401);
  });

  test("corpo que nao e JSON responde 400", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", "isso nao e json"));
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ error: "Corpo invalido" });
  });

  test("horario em formato errado responde 400", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(3, { hora: "25:00" })));
    expect(resposta.status).toBe(400);
  });

  test("agendamento com pagamento no local fica aguardando pagamento", async () => {
    entrarComo(e.cliente);
    vi.mocked(enviarEmail).mockClear();

    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(3)));
    expect(resposta.status).toBe(201);
    const { id, status } = await resposta.json();
    expect(status).toBe("PENDENTE_PAGAMENTO");

    // RN01: o valor vem da tabela de precos, nao do cliente.
    const gravado = await buscar(id);
    expect(Number(gravado!.valor)).toBe(80);
    expect(gravado!.usuarioId).toBe(e.cliente.id);
    // RF08: a confirmacao fica registrada junto com o agendamento e sai por
    // e-mail logo depois da resposta, ja fora da transacao.
    expect(gravado!.notificacoes.map((n) => [n.tipo, n.canal])).toEqual([["CONFIRMACAO_AGENDAMENTO", "EMAIL"]]);
    expect(enviarEmail).not.toHaveBeenCalled();
    await depoisDaResposta();
    expect(enviarEmail).toHaveBeenCalledWith(e.cliente.email, "Agendamento confirmado", expect.any(String));
  });

  test("agendamento por PIX fica com PIX pendente e devolve o codigo", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(4, { formaPagamento: "PIX" })));
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toMatchObject({
      status: "PIX_PENDENTE",
      pixChaveCopiaCola: e.tenant.pixChaveCopiaCola,
    });
  });

  test("horario ja ocupado responde 409 (capacidade de 1 carro)", async () => {
    entrarComo(e.cliente);
    expect((await agendar(pedido("POST", "/api/agendamentos", corpo(5)))).status).toBe(201);

    const segunda = await agendar(pedido("POST", "/api/agendamentos", corpo(5)));
    expect(segunda.status).toBe(409);
    expect(await segunda.json()).toEqual({ error: "Horario nao esta mais disponivel" });
  });

  test("fila do dia presa alem do limite responde 503, sem gravar", async () => {
    entrarComo(e.cliente);
    const [ano, mes, dia] = diaDaqui(7).split("-").map(Number);

    // Outra confirmacao segura a trava do dia ate a resposta chegar.
    let soltar!: () => void;
    const solta = new Promise<void>((resolve) => (soltar = resolve));
    const segurando = withTenant(e.tenant.id, async (tx) => {
      await travarDiaParaAgendamento(tx, e.tenant.id, instanteNoFuso(ano, mes, dia, 10, 0));
      await solta;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(7)));
    soltar();
    await segurando;

    expect(resposta.status).toBe(503);
    expect(resposta.headers.get("Retry-After")).toBe("2");
    expect(await resposta.json()).toEqual({
      error: "Muitas confirmacoes para esse dia agora. Tente de novo em instantes.",
    });
    const gravados = await withTenant(e.tenant.id, (tx) =>
      tx.agendamento.count({
        where: { tenantId: e.tenant.id, dataHora: instanteNoFuso(ano, mes, dia, 10, 0) },
      })
    );
    expect(gravados).toBe(0);
  });

  test("horario fora do funcionamento responde 409", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(6, { hora: "19:00" })));
    expect(resposta.status).toBe(409);
  });

  test("data que ja passou ou alem dos 14 dias responde 400", async () => {
    entrarComo(e.cliente);
    for (const dias of [-1, 14, 365]) {
      const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(dias)));
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({
        error: "Escolha uma data entre hoje e os proximos 14 dias",
      });
    }
  });

  test("data que nao existe (31/02) responde 400, sem virar outro dia", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", { ...corpo(3), data: "2027-02-31" }));
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ error: "Data invalida" });
  });

  test("carro de outro cliente responde 404", async () => {
    entrarComo(e.outroCliente);
    expect((await agendar(pedido("POST", "/api/agendamentos", corpo(7)))).status).toBe(404);
  });

  test("servico que nao existe responde 404", async () => {
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(7, { servicoId: randomUUID() })));
    expect(resposta.status).toBe(404);
  });

  test("servico pausado nao recebe agendamento novo (RN14)", async () => {
    const pausado = await withTenant(e.tenant.id, (tx) =>
      tx.servico.create({
        data: {
          tenantId: e.tenant.id,
          nome: "Polimento pausado",
          duracaoMin: 60,
          ativo: false,
          precos: { create: [{ tenantId: e.tenant.id, segmentoId: e.segmento.id, valor: 200 }] },
        },
      })
    );
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(8, { servicoId: pausado.id })));
    expect(resposta.status).toBe(404);
  });

  test("PIX sem chave configurada responde 400 (RN10)", async () => {
    await prisma.tenant.update({ where: { id: e.tenant.id }, data: { pixChaveCopiaCola: null } });
    try {
      entrarComo(e.cliente);
      const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(9, { formaPagamento: "PIX" })));
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({ error: "PIX nao disponivel" });
    } finally {
      await prisma.tenant.update({
        where: { id: e.tenant.id },
        data: { pixChaveCopiaCola: e.tenant.pixChaveCopiaCola },
      });
    }
  });

  test("carro de um tipo sem preco no servico responde 409", async () => {
    const picape = await withTenant(e.tenant.id, async (tx) => {
      const segmento = await tx.segmento.create({ data: { tenantId: e.tenant.id, nome: "Picape", ordem: 2 } });
      return tx.veiculo.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          marca: "Ford",
          modelo: "Ranger",
          placa: "PIC1A23",
          ano: 2021,
          cor: "Preta",
          segmentoId: segmento.id,
        },
      });
    });
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(10, { veiculoId: picape.id })));
    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({
      error: "Este servico ainda nao tem preco para o seu tipo de veiculo",
    });
  });

  test("carro de um tipo que a estetica deixou de atender responde 409", async () => {
    const van = await withTenant(e.tenant.id, async (tx) => {
      const segmento = await tx.segmento.create({
        data: { tenantId: e.tenant.id, nome: "Van", ordem: 3, ativo: false },
      });
      return tx.veiculo.create({
        data: {
          tenantId: e.tenant.id,
          usuarioId: e.cliente.id,
          marca: "Renault",
          modelo: "Master",
          placa: "VAN1A23",
          ano: 2019,
          cor: "Branca",
          segmentoId: segmento.id,
        },
      });
    });
    entrarComo(e.cliente);
    const resposta = await agendar(pedido("POST", "/api/agendamentos", corpo(11, { veiculoId: van.id })));
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).error).toContain("nao atende mais veiculos do tipo Van");
  });
});

describe("POST /api/agendamentos/[id]/cancelar", () => {
  const chamar = (id: string) => cancelar(pedido("POST", `/api/agendamentos/${id}/cancelar`), comId(id));

  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await chamar(randomUUID())).status).toBe(401);
  });

  test("agendamento que nao existe responde 404", async () => {
    entrarComo(e.cliente);
    expect((await chamar(randomUUID())).status).toBe(404);
  });

  test("cliente cancela o proprio agendamento dentro do prazo", async () => {
    const ag = await agendamentoNoBanco(daqui(72));
    entrarComo(e.cliente);

    const resposta = await chamar(ag.id);
    expect(resposta.status).toBe(200);
    const gravado = await buscar(ag.id);
    expect(gravado!.status).toBe("CANCELADO");
    expect(gravado!.notificacoes.map((n) => n.tipo)).toEqual(["CONFIRMACAO_CANCELAMENTO"]);
  });

  test("agendamento ja cancelado ou concluido nao cancela de novo", async () => {
    entrarComo(e.cliente);
    for (const status of ["CANCELADO", "CONCLUIDO"] as const) {
      const ag = await agendamentoNoBanco(daqui(72), status);
      const resposta = await chamar(ag.id);
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({ error: "Agendamento ja finalizado" });
    }
  });

  test("cliente fora do prazo de cancelamento recebe 403 (RN11)", async () => {
    // A estetica de teste exige 24 h de antecedencia.
    const ag = await agendamentoNoBanco(daqui(5));
    entrarComo(e.cliente);

    const resposta = await chamar(ag.id);
    expect(resposta.status).toBe(403);
    expect((await resposta.json()).error).toContain("Fora do prazo");
    expect((await buscar(ag.id))!.status).toBe("PENDENTE_PAGAMENTO");
  });

  test("cliente nao cancela o agendamento de outro cliente", async () => {
    const ag = await agendamentoNoBanco(daqui(72));
    entrarComo(e.outroCliente);
    expect((await chamar(ag.id)).status).toBe(403);
  });

  test("Admin cancela mesmo fora do prazo", async () => {
    const ag = await agendamentoNoBanco(daqui(5));
    entrarComo(e.admin);
    expect((await chamar(ag.id)).status).toBe(200);
    expect((await buscar(ag.id))!.status).toBe("CANCELADO");
  });
});

describe("POST /api/agendamentos/[id]/confirmar-pagamento", () => {
  const chamar = (id: string, corpo?: unknown) =>
    confirmarPagamento(pedido("POST", `/api/agendamentos/${id}/confirmar-pagamento`, corpo), comId(id));

  test("so o Admin confirma pagamento", async () => {
    const ag = await agendamentoNoBanco(daqui(48));
    entrarComo(null);
    expect((await chamar(ag.id)).status).toBe(403);
    entrarComo(e.cliente);
    expect((await chamar(ag.id)).status).toBe(403);
  });

  test("agendamento que nao existe responde 404", async () => {
    entrarComo(e.admin);
    expect((await chamar(randomUUID())).status).toBe(404);
  });

  test("sem corpo, confirma pelo valor combinado", async () => {
    const ag = await agendamentoNoBanco(daqui(48));
    entrarComo(e.admin);

    const resposta = await chamar(ag.id);
    expect(await resposta.json()).toEqual({ ok: true, acrescimoAplicado: null });
    const gravado = await buscar(ag.id);
    expect(gravado!.status).toBe("CONFIRMADO");
    expect(Number(gravado!.valor)).toBe(80);
  });

  test("PIX pendente tambem pode ser confirmado, com acrescimo em reais", async () => {
    const ag = await agendamentoNoBanco(daqui(48), "PIX_PENDENTE");
    entrarComo(e.admin);

    expect(await (await chamar(ag.id, { acrescimo: 24 })).json()).toEqual({ ok: true, acrescimoAplicado: 24 });
    const gravado = await buscar(ag.id);
    expect(Number(gravado!.acrescimoAplicado)).toBe(24);
    // RN01: o valor combinado nao muda; o acrescimo fica em separado.
    expect(Number(gravado!.valor)).toBe(80);
  });

  test("acrescimo maior que o valor do servico responde 400", async () => {
    const ag = await agendamentoNoBanco(daqui(48));
    entrarComo(e.admin);
    const resposta = await chamar(ag.id, { acrescimo: 81 });
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ error: "O acrescimo nao pode passar do valor do servico" });
  });

  test("acrescimo negativo responde 400", async () => {
    const ag = await agendamentoNoBanco(daqui(48));
    entrarComo(e.admin);
    expect((await chamar(ag.id, { acrescimo: -5 })).status).toBe(400);
  });

  test("agendamento que nao aguarda pagamento responde 400", async () => {
    const ag = await agendamentoNoBanco(daqui(48), "CONFIRMADO");
    entrarComo(e.admin);
    const resposta = await chamar(ag.id);
    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ error: "Este agendamento nao esta aguardando pagamento" });
  });
});

describe("GET /api/slots", () => {
  const chamar = (parametros: Record<string, string>) =>
    consultarSlots(pedido("GET", `/api/slots?${new URLSearchParams(parametros)}`));

  test("sem login responde 401", async () => {
    entrarComo(null);
    expect((await chamar({})).status).toBe(401);
  });

  test("parametro faltando responde 400", async () => {
    entrarComo(e.cliente);
    expect((await chamar({ tenantId: e.tenant.id, servicoId: e.servico.id })).status).toBe(400);
  });

  test("consultar outra estetica responde 403", async () => {
    entrarComo(e.cliente);
    const resposta = await chamar({ tenantId: randomUUID(), servicoId: e.servico.id, data: diaDaqui(12) });
    expect(resposta.status).toBe(403);
  });

  test("data fora do formato AAAA-MM-DD responde 400", async () => {
    entrarComo(e.cliente);
    const resposta = await chamar({ tenantId: e.tenant.id, servicoId: e.servico.id, data: "29/10/2026" });
    expect(resposta.status).toBe(400);
  });

  test("data fora da janela de 14 dias responde 400", async () => {
    entrarComo(e.cliente);
    const resposta = await chamar({ tenantId: e.tenant.id, servicoId: e.servico.id, data: diaDaqui(30) });
    expect(resposta.status).toBe(400);
  });

  test("servico que nao existe responde 404", async () => {
    entrarComo(e.cliente);
    const resposta = await chamar({ tenantId: e.tenant.id, servicoId: randomUUID(), data: diaDaqui(12) });
    expect(resposta.status).toBe(404);
  });

  test("lista os horarios livres e tira o que ja foi agendado", async () => {
    entrarComo(e.cliente);
    const parametros = { tenantId: e.tenant.id, servicoId: e.servico.id, data: diaDaqui(12) };

    const antes = await (await chamar(parametros)).json();
    expect(antes.slots).toEqual([
      "08:00", "09:00", "10:00", "11:00", "12:00",
      "13:00", "14:00", "15:00", "16:00", "17:00",
    ]);

    await agendar(
      pedido("POST", "/api/agendamentos", {
        servicoId: e.servico.id,
        veiculoId: e.veiculo.id,
        data: diaDaqui(12),
        hora: "10:00",
        formaPagamento: "LOCAL",
      })
    );
    const depois = await (await chamar(parametros)).json();
    expect(depois.slots).not.toContain("10:00");
    expect(depois.slots).toHaveLength(9);
  });
});
