import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
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
// da aplicacao). Rodar com:
//   npm run test:notificacao

process.env.RESEND_API_KEY = "re_chave_falsa_de_teste";
process.env.TELEGRAM_BOT_TOKEN = "token-falso-de-teste";

let atrasoDaRedeMs = 0;
let chamadasDeRede = 0;
globalThis.fetch = async () => {
  chamadasDeRede++;
  await esperar(atrasoDaRedeMs);
  throw new TypeError("fetch failed (rede fora do ar, simulado)");
};

// Carregados no before(), depois das chaves e do fetch ja trocados.
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

before(async () => {
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
  await withTenant(f.tenantId, async (tx) => {
    await tx.notificacao.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.agendamento.deleteMany({ where: { tenantId: f.tenantId } });
  });
});

after(async () => {
  if (f) await removerFixture(f.tenantId);
  await prisma.$disconnect();
});

describe("confirmacao de agendamento", () => {
  // Controle: a ordem antiga — enviar dentro da transacao — perde o
  // agendamento quando o Telegram cai. Prova que a simulacao reproduz o defeito.
  test("enviando dentro da transacao, o Telegram fora do ar desfaz o agendamento (o defeito)", async () => {
    await assert.rejects(
      withTenant(f.tenantId, async (tx) => {
        await tx.agendamento.create({ data: dadosDoAgendamento(new Date(Date.now() + 72 * HORA_EM_MS)) });
        await enviarTelegram("123456", "Seu agendamento foi confirmado");
      })
    );
    assert.equal(await contarAgendamentos(), 0);
  });

  test("registrando dentro e enviando depois do commit, o agendamento fica salvo", async () => {
    const pendente = await withTenant(f.tenantId, async (tx) => {
      const agendamento = await tx.agendamento.create({
        data: dadosDoAgendamento(new Date(Date.now() + 72 * HORA_EM_MS)),
      });
      return notificacoes.registrarNotificacao(tx, agendamento.id, "CONFIRMACAO_AGENDAMENTO");
    });

    // Nao lanca, mesmo com e-mail e Telegram fora do ar.
    await notificacoes.enviarNotificacao(pendente);

    assert.equal(await contarAgendamentos(), 1);
    const [notificacao] = await listarNotificacoes();
    assert.equal(notificacao.status, "FALHA");
    assert.equal(notificacao.tentativas, 1);
    assert.ok(chamadasDeRede >= 2, "tentou o e-mail e o Telegram");
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

    assert.equal(primeira.lembretes24h, 1);
    assert.equal(segunda.lembretes24h, 0);
    assert.equal(chamadasDeRede, chamadasDaPrimeira, "a segunda rodada nao tentou enviar");

    const lembretes = (await listarNotificacoes()).filter((n) => n.tipo === "LEMBRETE_24H");
    assert.equal(lembretes.length, 1);
    assert.equal(lembretes[0].status, "FALHA");
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

    assert.equal(rodada.lembretes24h, 1);
    const lembretes = (await listarNotificacoes()).filter((n) => n.tipo === "LEMBRETE_24H");
    assert.equal(lembretes.length, 1);
  });
});
