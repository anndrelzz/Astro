import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { setTimeout as esperar } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";

// Envio de e-mail e Telegram fora da transacao (secao 3.4 do RFC).
//
// O fetch global e trocado por um que simula Resend e Telegram fora do ar (ou
// lentos): nenhum e-mail ou mensagem de verdade sai daqui. As chaves sao
// substituidas ANTES de importar lib/notificacoes, porque email.ts le a
// RESEND_API_KEY no carregamento do modulo.
//
// Requer um PostgreSQL real com as migrations aplicadas (o mesmo DATABASE_URL
// da aplicacao), como os testes de RLS.

process.env.RESEND_API_KEY = "re_chave_falsa_de_teste";
process.env.TELEGRAM_BOT_TOKEN = "token-falso-de-teste";

let atrasoDaRedeMs = 0;
let chamadasDeRede = 0;
// Com a rede de volta, responde como o Resend e o Telegram respondem a um
// envio aceito.
let redeNoAr = false;
globalThis.fetch = async (url) => {
  chamadasDeRede++;
  await esperar(atrasoDaRedeMs);
  if (!redeNoAr) throw new TypeError("fetch failed (rede fora do ar, simulado)");
  const corpo = String(url).includes("api.telegram.org") ? { ok: true } : { id: "email-simulado" };
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// Carregados no beforeAll(), depois das chaves e do fetch ja trocados.
let notificacoes: typeof import("@/lib/notificacoes");
let enviarTelegram: typeof import("@/lib/notificacoes/telegram").enviarTelegram;
let verificarLembretesDoTenant: typeof import("@/lib/notificacoes/lembretes").verificarLembretesDoTenant;

const PREFIXO = "__test__notificacao";
const HORA_EM_MS = 1000 * 60 * 60;

type Fixture = {
  tenantId: string;
  servicoId: string;
  usuarioId: string;
  veiculoId: string;
};

let f: Fixture;

async function criarFixture(): Promise<Fixture> {
  const tenant = await prisma.tenant.create({
    data: { nome: "Estetica de teste notificacao", slug: `${PREFIXO}-tenant` },
  });

  return withTenant(tenant.id, async (tx) => {
    const segmento = await tx.segmento.create({
      data: { tenantId: tenant.id, nome: "Hatch", ordem: 1 },
    });
    const servico = await tx.servico.create({
      data: { tenantId: tenant.id, nome: "Lavagem", duracaoMin: 60 },
    });
    // Com Telegram vinculado, para o envio passar pelos dois canais.
    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome: "Cliente",
        email: "cliente@notificacao.local",
        senhaHash: "$2b$10$hashfalsoparateste0000000000000000000000000000000000",
        telegramChatId: "123456",
      },
    });
    const veiculo = await tx.veiculo.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        marca: "Fiat",
        modelo: "Uno",
        placa: "NNN1N11",
        ano: 2020,
        cor: "Preto",
        segmentoId: segmento.id,
      },
    });
    return {
      tenantId: tenant.id,
      servicoId: servico.id,
      usuarioId: usuario.id,
      veiculoId: veiculo.id,
    };
  });
}

async function removerFixture(tenantId: string) {
  await withTenant(tenantId, async (tx) => {
    await tx.notificacao.deleteMany({ where: { tenantId } });
    await tx.agendamento.deleteMany({ where: { tenantId } });
    await tx.veiculo.deleteMany({ where: { tenantId } });
    await tx.usuario.deleteMany({ where: { tenantId } });
    await tx.servico.deleteMany({ where: { tenantId } });
    await tx.segmento.deleteMany({ where: { tenantId } });
  });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

function dadosDoAgendamento(dataHora: Date, criadoEm = new Date()) {
  return {
    tenantId: f.tenantId,
    usuarioId: f.usuarioId,
    veiculoId: f.veiculoId,
    servicoId: f.servicoId,
    dataHora,
    criadoEm,
    formaPagamento: "LOCAL" as const,
    valor: 60,
  };
}

const contarAgendamentos = () =>
  withTenant(f.tenantId, (tx) => tx.agendamento.count({ where: { tenantId: f.tenantId } }));

const listarNotificacoes = () =>
  withTenant(f.tenantId, (tx) => tx.notificacao.findMany({ where: { tenantId: f.tenantId } }));

beforeAll(async () => {
  notificacoes = await import("@/lib/notificacoes");
  ({ enviarTelegram } = await import("@/lib/notificacoes/telegram"));
  ({ verificarLembretesDoTenant } = await import("@/lib/notificacoes/lembretes"));

  const orfaos = await prisma.tenant.findMany({
    where: { slug: { startsWith: PREFIXO } },
    select: { id: true },
  });
  for (const t of orfaos) await removerFixture(t.id);

  f = await criarFixture();
});

beforeEach(async () => {
  atrasoDaRedeMs = 0;
  chamadasDeRede = 0;
  redeNoAr = false;
  await withTenant(f.tenantId, async (tx) => {
    await tx.notificacao.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.agendamento.deleteMany({ where: { tenantId: f.tenantId } });
  });
});

afterAll(async () => {
  if (f) await removerFixture(f.tenantId);
  await prisma.$disconnect();
});

describe("confirmacao de agendamento", () => {
  // Controle: a ordem antiga — enviar dentro da transacao — perde o
  // agendamento quando o Telegram cai. Prova que a simulacao reproduz o defeito.
  test("enviando dentro da transacao, o Telegram fora do ar desfaz o agendamento (o defeito)", async () => {
    await expect(
      withTenant(f.tenantId, async (tx) => {
        await tx.agendamento.create({ data: dadosDoAgendamento(new Date(Date.now() + 72 * HORA_EM_MS)) });
        await enviarTelegram("123456", "Seu agendamento foi confirmado");
      })
    ).rejects.toThrow();
    expect(await contarAgendamentos()).toBe(0);
  });

  test("registrando dentro e enviando depois do commit, o agendamento fica salvo", async () => {
    const pendentes = await withTenant(f.tenantId, async (tx) => {
      const agendamento = await tx.agendamento.create({
        data: dadosDoAgendamento(new Date(Date.now() + 72 * HORA_EM_MS)),
      });
      return notificacoes.registrarNotificacao(tx, agendamento.id, "CONFIRMACAO_AGENDAMENTO");
    });

    // Nao lanca, mesmo com e-mail e Telegram fora do ar.
    await notificacoes.enviarNotificacoes(pendentes);

    expect(await contarAgendamentos()).toBe(1);
    // Uma linha por canal, cada uma com o proprio resultado.
    const gravadas = await listarNotificacoes();
    expect(gravadas.map((n) => n.canal).sort()).toEqual(["EMAIL", "TELEGRAM"]);
    expect(gravadas.every((n) => n.status === "FALHA" && n.tentativas === 1)).toBe(true);
    expect(chamadasDeRede).toBeGreaterThanOrEqual(2); // tentou o e-mail e o Telegram
  });
});

describe("lembretes do cron", () => {
  test("um envio que falha nao faz o lembrete ser mandado de novo na rodada seguinte", async () => {
    const agora = new Date();
    await withTenant(f.tenantId, (tx) =>
      tx.agendamento.create({
        data: dadosDoAgendamento(
          new Date(agora.getTime() + 20 * HORA_EM_MS),
          new Date(agora.getTime() - 48 * HORA_EM_MS)
        ),
      })
    );

    const primeira = await verificarLembretesDoTenant(f.tenantId, agora);
    const chamadasDaPrimeira = chamadasDeRede;
    const segunda = await verificarLembretesDoTenant(f.tenantId, agora);

    expect(primeira.lembretes24h).toBe(1);
    expect(segunda.lembretes24h).toBe(0);
    expect(chamadasDeRede).toBe(chamadasDaPrimeira); // a segunda rodada nao tentou enviar

    const lembretes = (await listarNotificacoes()).filter((n) => n.tipo === "LEMBRETE_24H");
    expect(lembretes.map((n) => n.canal).sort()).toEqual(["EMAIL", "TELEGRAM"]);
    expect(lembretes.every((n) => n.status === "FALHA")).toBe(true);
  });

  // Com o envio dentro da transacao, 6 s de rede estouravam o limite de 5 s
  // do Prisma e o rollback apagava o registro do lembrete.
  test("um envio lento (6 s) nao desfaz o registro do lembrete", { timeout: 30_000 }, async () => {
    atrasoDaRedeMs = 3_000; // e-mail + Telegram = 6 s
    const agora = new Date();
    await withTenant(f.tenantId, (tx) =>
      tx.agendamento.create({
        data: dadosDoAgendamento(
          new Date(agora.getTime() + 20 * HORA_EM_MS),
          new Date(agora.getTime() - 48 * HORA_EM_MS)
        ),
      })
    );

    const rodada = await verificarLembretesDoTenant(f.tenantId, agora);

    expect(rodada.lembretes24h).toBe(1);
    const lembretes = (await listarNotificacoes()).filter((n) => n.tipo === "LEMBRETE_24H");
    expect(lembretes).toHaveLength(2); // e-mail e Telegram
  });
});

describe("reenvio pelo cron", () => {
  const MINUTO_EM_MS = 60 * 1000;

  // Agendamento com uma notificacao ja gravada no estado que o teste quer.
  async function notificacaoNoBanco(
    dados: {
      tipo?: "CONFIRMACAO_AGENDAMENTO" | "CONFIRMACAO_CANCELAMENTO" | "LEMBRETE_24H";
      canal?: "EMAIL" | "TELEGRAM";
      status: "PENDENTE" | "FALHA";
      tentativas?: number;
      criadaHaMin?: number;
    },
    agendamento: { horasAte?: number; cancelado?: boolean } = {}
  ) {
    return withTenant(f.tenantId, async (tx) => {
      const ag = await tx.agendamento.create({
        data: {
          ...dadosDoAgendamento(new Date(Date.now() + (agendamento.horasAte ?? 48) * HORA_EM_MS)),
          status: agendamento.cancelado ? "CANCELADO" : "PENDENTE_PAGAMENTO",
        },
      });
      return tx.notificacao.create({
        data: {
          tenantId: f.tenantId,
          agendamentoId: ag.id,
          tipo: dados.tipo ?? "CONFIRMACAO_AGENDAMENTO",
          canal: dados.canal ?? "EMAIL",
          status: dados.status,
          tentativas: dados.tentativas ?? 0,
          criadoEm: new Date(Date.now() - (dados.criadaHaMin ?? 0) * MINUTO_EM_MS),
        },
      });
    });
  }

  const buscar = (id: string) =>
    withTenant(f.tenantId, (tx) => tx.notificacao.findUniqueOrThrow({ where: { id } }));

  test("falha com menos de 3 tentativas e enviada de novo e, com a rede no ar, vira ENVIADA", async () => {
    const n = await notificacaoNoBanco({ status: "FALHA", tentativas: 1 });
    redeNoAr = true;

    expect(await notificacoes.reenviarNotificacoesDoTenant(f.tenantId)).toEqual({ reenviadas: 1 });
    expect(await buscar(n.id)).toMatchObject({ status: "ENVIADA", tentativas: 2 });
  });

  test("falha que continua falhando conta a tentativa e para em 3", async () => {
    const n = await notificacaoNoBanco({ status: "FALHA", tentativas: 2, canal: "TELEGRAM" });

    await notificacoes.reenviarNotificacoesDoTenant(f.tenantId);
    expect(await buscar(n.id)).toMatchObject({ status: "FALHA", tentativas: 3 });

    // Na terceira tentativa ela sai da fila.
    chamadasDeRede = 0;
    expect(await notificacoes.reenviarNotificacoesDoTenant(f.tenantId)).toEqual({ reenviadas: 0 });
    expect(chamadasDeRede).toBe(0);
  });

  test("pendente esquecida (servidor caiu antes do envio) e enviada; recente ainda nao", async () => {
    const esquecida = await notificacaoNoBanco({ status: "PENDENTE", criadaHaMin: 10 });
    const recente = await notificacaoNoBanco({ status: "PENDENTE", criadaHaMin: 1 });
    redeNoAr = true;

    expect(await notificacoes.reenviarNotificacoesDoTenant(f.tenantId)).toEqual({ reenviadas: 1 });
    expect((await buscar(esquecida.id)).status).toBe("ENVIADA");
    expect((await buscar(recente.id)).status).toBe("PENDENTE");
  });

  test("so reenvia o que ainda faz sentido", async () => {
    // Nao reenvia: lembrete de horario que ja passou e confirmacao de agendamento cancelado.
    await notificacaoNoBanco({ tipo: "LEMBRETE_24H", status: "FALHA", tentativas: 1 }, { horasAte: -2 });
    await notificacaoNoBanco({ status: "FALHA", tentativas: 1 }, { cancelado: true });
    // Reenvia: o aviso de cancelamento vale mesmo com o agendamento cancelado.
    const cancelamento = await notificacaoNoBanco(
      { tipo: "CONFIRMACAO_CANCELAMENTO", status: "FALHA", tentativas: 1 },
      { cancelado: true }
    );
    redeNoAr = true;

    expect(await notificacoes.reenviarNotificacoesDoTenant(f.tenantId)).toEqual({ reenviadas: 1 });
    expect((await buscar(cancelamento.id)).status).toBe("ENVIADA");
  });
});
