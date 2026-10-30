import { setTimeout as esperar } from "node:timers/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { instanteNoFuso } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { calcularSlotsDisponiveis, FilaDeAgendamentoOcupada, travarDiaParaAgendamento } from "@/lib/slots";
import { withTenant } from "@/lib/tenant-db";

// Confirmacoes simultaneas para o mesmo horario (RN06 — capacidade simultanea).
//
// Reproduz os passos de POST /api/agendamentos que importam para a disputa:
// trava do dia, reconferencia da vaga e gravacao. Uma pausa antes do commit
// garante que as transacoes sempre se sobreponham.
//
// Requer um PostgreSQL real com as migrations aplicadas (o mesmo DATABASE_URL
// da aplicacao).

const PREFIXO = "__test__concorrencia";
const HORA = "17:00";
const DATA_HORA = instanteNoFuso(2027, 3, 10, 17, 0);
const PAUSA_ANTES_DO_COMMIT_MS = 300;

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

// Promessa que so resolve quando `total` participantes chegaram nela.
function barreira(total: number) {
  let chegaram = 0;
  let liberar!: () => void;
  const todos = new Promise<void>((resolve) => (liberar = resolve));
  return () => {
    if (++chegaram === total) liberar();
    return todos;
  };
}

// Os mesmos passos da rota, na mesma ordem. `depoisDeLer` segura a gravacao
// ate as outras confirmacoes tambem lerem a vaga: com o computador ocupado,
// uma pode terminar antes da outra comecar, e entao nao haveria disputa.
async function confirmar(
  cliente: Cliente,
  { comTrava, depoisDeLer }: { comTrava: boolean; depoisDeLer?: () => Promise<void> }
) {
  return withTenant(f.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: f.tenantId } });
    const servico = await tx.servico.findUniqueOrThrow({ where: { id: f.servicoId } });

    if (comTrava) await travarDiaParaAgendamento(tx, tenant.id, DATA_HORA);

    const slots = await calcularSlotsDisponiveis(tx, tenant, servico, DATA_HORA);
    await depoisDeLer?.();
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
    await esperar(PAUSA_ANTES_DO_COMMIT_MS);
    return "gravado" as const;
  });
}

async function agendamentosNoHorario() {
  return withTenant(f.tenantId, (tx) =>
    tx.agendamento.count({ where: { tenantId: f.tenantId, dataHora: DATA_HORA } })
  );
}

beforeAll(async () => {
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

afterAll(async () => {
  if (f) await removerFixture(f.tenantId);
  await prisma.$disconnect();
});

describe("confirmacoes simultaneas no mesmo horario", () => {
  // Controle: prova que o teste reproduz a disputa de verdade. Se este caso
  // deixar de gravar os dois, os casos com trava nao estariam provando nada.
  test("sem a trava, capacidade 1: os dois gravam (o defeito)", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 1 } });

    const [c1, c2] = f.clientes;
    const depoisDeLer = barreira(2);
    const resultados = await Promise.all([
      confirmar(c1, { comTrava: false, depoisDeLer }),
      confirmar(c2, { comTrava: false, depoisDeLer }),
    ]);

    expect(resultados).toEqual(["gravado", "gravado"]);
    expect(await agendamentosNoHorario()).toBe(2);
  });

  test("com a trava, capacidade 1: um grava, o outro e recusado", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 1 } });

    const [c1, c2] = f.clientes;
    const resultados = await Promise.all([
      confirmar(c1, { comTrava: true }),
      confirmar(c2, { comTrava: true }),
    ]);

    expect([...resultados].sort()).toEqual(["gravado", "recusado"]);
    expect(await agendamentosNoHorario()).toBe(1);
  });

  test("com a trava, capacidade 2: tres disputam, dois gravam", async () => {
    await prisma.tenant.update({ where: { id: f.tenantId }, data: { capacidadeSimultanea: 2 } });

    const resultados = await Promise.all(
      f.clientes.map((c) => confirmar(c, { comTrava: true }))
    );

    expect([...resultados].sort()).toEqual(["gravado", "gravado", "recusado"]);
    expect(await agendamentosNoHorario()).toBe(2);
  });
});

describe("espera maxima na fila", () => {
  test("fila parada alem do limite: desiste com FilaDeAgendamentoOcupada", async () => {
    // Uma confirmacao segura a trava do dia por 800 ms; a outra so aceita
    // esperar 200 ms.
    const segurando = withTenant(f.tenantId, async (tx) => {
      await travarDiaParaAgendamento(tx, f.tenantId, DATA_HORA);
      await esperar(800);
    });
    await esperar(100);

    const inicio = Date.now();
    await expect(
      withTenant(f.tenantId, (tx) => travarDiaParaAgendamento(tx, f.tenantId, DATA_HORA, 200))
    ).rejects.toBeInstanceOf(FilaDeAgendamentoOcupada);
    // Desistiu perto do limite, sem esperar a outra terminar.
    expect(Date.now() - inicio).toBeLessThan(700);

    await segurando;
  });

  test("depois de pegar a trava, o limite de espera nao vale para o resto da transacao", async () => {
    const limite = await withTenant(f.tenantId, async (tx) => {
      await travarDiaParaAgendamento(tx, f.tenantId, DATA_HORA, 200);
      const [linha] = await tx.$queryRaw<{ lock_timeout: string }[]>`SHOW lock_timeout`;
      return linha.lock_timeout;
    });

    expect(limite).toBe("0");
  });
});
