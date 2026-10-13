import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as esperar } from "node:timers/promises";
import { instanteNoFuso } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { calcularSlotsDisponiveis, travarDiaParaAgendamento } from "@/lib/slots";
import { withTenant } from "@/lib/tenant-db";

// Confirmacoes simultaneas para o mesmo horario (RN06 — capacidade simultanea).
//
// Reproduz os passos de POST /api/agendamentos que importam para a disputa:
// trava do dia, reconferencia da vaga, gravacao e, antes do commit, a espera
// pelo envio do e-mail — simulada aqui por uma pausa, para que as duas
// transacoes sempre se sobreponham.
//
// Requer um PostgreSQL real com as migrations aplicadas (o mesmo DATABASE_URL
// da aplicacao). Rodar com:
//   npm run test:concorrencia

const PREFIXO = "__test__concorrencia";
const HORA = "17:00";
const DATA_HORA = instanteNoFuso(2027, 3, 10, 17, 0);
const PAUSA_DO_EMAIL_MS = 300;

type Cliente = { usuarioId: string; veiculoId: string };
type Fixture = { tenantId: string; servicoId: string; clientes: Cliente[] };

let f: Fixture;

async function criarFixture(): Promise<Fixture> {
  const tenant = await prisma.tenant.create({
    data: { nome: "Estetica de teste concorrencia", slug: `${PREFIXO}-tenant` },
  });

  return withTenant(tenant.id, async (tx) => {
    const segmento = await tx.segmento.create({
      data: { tenantId: tenant.id, nome: "Hatch", ordem: 1 },
    });
    const servico = await tx.servico.create({
      data: {
        tenantId: tenant.id,
        nome: "Lavagem",
        duracaoMin: 60,
        precos: { create: [{ tenantId: tenant.id, segmentoId: segmento.id, valor: 60 }] },
      },
    });
    // Aberto todos os dias, para o teste nao depender do dia da semana.
    await tx.horarioFuncionamento.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        tenantId: tenant.id,
        diaSemana,
        horaInicioMin: 480,
        horaFimMin: 1080,
      })),
    });

    const clientes: Cliente[] = [];
    for (const n of [1, 2, 3]) {
      const usuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome: `Cliente ${n}`,
          email: `cliente-${n}@concorrencia.local`,
          senhaHash: "$2b$10$hashfalsoparateste0000000000000000000000000000000000",
        },
      });
      const veiculo = await tx.veiculo.create({
        data: {
          tenantId: tenant.id,
          usuarioId: usuario.id,
          marca: "Fiat",
          modelo: "Uno",
          placa: `CCC${n}C1${n}`,
          ano: 2020,
          cor: "Preto",
          segmentoId: segmento.id,
        },
      });
      clientes.push({ usuarioId: usuario.id, veiculoId: veiculo.id });
    }

    return { tenantId: tenant.id, servicoId: servico.id, clientes };
  });
}

async function removerFixture(tenantId: string) {
  await withTenant(tenantId, async (tx) => {
    await tx.agendamento.deleteMany({ where: { tenantId } });
    await tx.precoServico.deleteMany({ where: { tenantId } });
    await tx.veiculo.deleteMany({ where: { tenantId } });
    await tx.horarioFuncionamento.deleteMany({ where: { tenantId } });
    await tx.usuario.deleteMany({ where: { tenantId } });
    await tx.servico.deleteMany({ where: { tenantId } });
    await tx.segmento.deleteMany({ where: { tenantId } });
  });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

// Os mesmos passos da rota, na mesma ordem.
async function confirmar(cliente: Cliente, { comTrava }: { comTrava: boolean }) {
  return withTenant(f.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: f.tenantId } });
    const servico = await tx.servico.findUniqueOrThrow({ where: { id: f.servicoId } });

    if (comTrava) await travarDiaParaAgendamento(tx, tenant.id, DATA_HORA);

    const slots = await calcularSlotsDisponiveis(tx, tenant, servico, DATA_HORA);
    if (!slots.includes(HORA)) return "recusado" as const;

    await tx.agendamento.create({
      data: {
        tenantId: tenant.id,
        usuarioId: cliente.usuarioId,
        veiculoId: cliente.veiculoId,
        servicoId: servico.id,
        dataHora: DATA_HORA,
        formaPagamento: "LOCAL",
        valor: 60,
      },
    });
    await esperar(PAUSA_DO_EMAIL_MS);
    return "gravado" as const;
  });
}

async function agendamentosNoHorario() {
  return withTenant(f.tenantId, (tx) =>
    tx.agendamento.count({ where: { tenantId: f.tenantId, dataHora: DATA_HORA } })
  );
}

before(async () => {
  // Remove sobras de uma execucao anterior interrompida.
  const orfaos = await prisma.tenant.findMany({
    where: { slug: { startsWith: PREFIXO } },
    select: { id: true },
  });
  for (const t of orfaos) await removerFixture(t.id);

  f = await criarFixture();
});

beforeEach(async () => {
  await withTenant(f.tenantId, (tx) =>
    tx.agendamento.deleteMany({ where: { tenantId: f.tenantId } })
  );
});

after(async () => {
  if (f) await removerFixture(f.tenantId);
  await prisma.$disconnect();
});

describe("confirmacoes simultaneas no mesmo horario", () => {
  // Controle: prova que o teste reproduz a disputa de verdade. Se este caso
  // deixar de gravar os dois, os casos com trava nao estariam provando nada.
  test("sem a trava, capacidade 1: os dois gravam (o defeito)", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 1 } });

    const [c1, c2] = f.clientes;
    const resultados = await Promise.all([
      confirmar(c1, { comTrava: false }),
      confirmar(c2, { comTrava: false }),
    ]);

    assert.deepEqual(resultados, ["gravado", "gravado"]);
    assert.equal(await agendamentosNoHorario(), 2);
  });

  test("com a trava, capacidade 1: um grava, o outro e recusado", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 1 } });

    const [c1, c2] = f.clientes;
    const resultados = await Promise.all([
      confirmar(c1, { comTrava: true }),
      confirmar(c2, { comTrava: true }),
    ]);

    assert.deepEqual([...resultados].sort(), ["gravado", "recusado"]);
    assert.equal(await agendamentosNoHorario(), 1);
  });

  test("com a trava, capacidade 2: tres disputam, dois gravam", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 2 } });

    const resultados = await Promise.all(
      f.clientes.map((c) => confirmar(c, { comTrava: true }))
    );

    assert.deepEqual([...resultados].sort(), ["gravado", "gravado", "recusado"]);
    assert.equal(await agendamentosNoHorario(), 2);
  });
});
