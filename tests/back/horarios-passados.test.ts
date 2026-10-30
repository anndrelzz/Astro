import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { instanteNoFuso } from "@/compartilhado/fuso";
import { prisma } from "@/back/prisma";
import { calcularSlotsDisponiveis } from "@/back/slots";
import { withTenant } from "@/back/tenant-db";

// Horarios que ja passaram, ou que comecam em menos de 30 minutos, nao sao
// oferecidos (ANTECEDENCIA_MINIMA_MIN em back/slots.ts). A confirmacao reconfere
// a vaga pela mesma funcao, entao o que nao aparece aqui tambem e recusado no
// POST /api/agendamentos.
//
// O relogio e fixado pelo parametro `agora`: o resultado nao depende da hora
// em que o teste roda.
//
// Requer um PostgreSQL real com as migrations aplicadas (o mesmo DATABASE_URL
// da aplicacao), como os testes de RLS.

const PREFIXO = "__test__horarios";

// Grade das 08:00 as 18:00, servico de 1h, um horario por hora.
const TODOS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const DIA = { ano: 2027, mes: 3, dia: 10 };

type Fixture = { tenantId: string; servicoId: string };

let f: Fixture;

async function criarFixture(): Promise<Fixture> {
  const tenant = await prisma.tenant.create({
    data: {
      nome: "Estetica de teste horarios",
      slug: `${PREFIXO}-tenant`,
      intervaloMinutos: 60,
      capacidadeSimultanea: 1,
    },
  });

  return withTenant(tenant.id, async (tx) => {
    const servico = await tx.servico.create({
      data: { tenantId: tenant.id, nome: "Lavagem", duracaoMin: 60 },
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
    return { tenantId: tenant.id, servicoId: servico.id };
  });
}

async function removerFixture(tenantId: string) {
  await withTenant(tenantId, async (tx) => {
    await tx.horarioFuncionamento.deleteMany({ where: { tenantId } });
    await tx.servico.deleteMany({ where: { tenantId } });
  });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

/** Slots do dia DIA (deslocado em `dias`) vistos com o relogio da estetica em `hora`:`minuto` de DIA. */
async function slotsVistosAs(hora: number, minuto: number, dias = 0) {
  return withTenant(f.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: f.tenantId } });
    const servico = await tx.servico.findUniqueOrThrow({ where: { id: f.servicoId } });
    const data = instanteNoFuso(DIA.ano, DIA.mes, DIA.dia + dias);
    const agora = instanteNoFuso(DIA.ano, DIA.mes, DIA.dia, hora, minuto);
    return calcularSlotsDisponiveis(tx, tenant, servico, data, agora);
  });
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

afterAll(async () => {
  if (f) await removerFixture(f.tenantId);
  await prisma.$disconnect();
});

describe("horarios que ja passaram", () => {
  test("hoje as 13:00: so a partir das 14:00 (13:00 ja comecou)", async () => {
    expect(await slotsVistosAs(13, 0)).toEqual(["14:00", "15:00", "16:00", "17:00"]);
  });

  test("hoje as 12:55: 13:00 fica de fora, falta menos de 30 minutos", async () => {
    expect(await slotsVistosAs(12, 55)).toEqual(["14:00", "15:00", "16:00", "17:00"]);
  });

  test("hoje as 12:30: 13:00 ainda entra, faltam exatos 30 minutos", async () => {
    expect(await slotsVistosAs(12, 30)).toEqual(["13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  test("hoje antes de abrir: o dia inteiro", async () => {
    expect(await slotsVistosAs(6, 0)).toEqual(TODOS);
  });

  test("hoje depois do ultimo horario: nenhum", async () => {
    expect(await slotsVistosAs(17, 45)).toEqual([]);
  });

  test("amanha: o dia inteiro, mesmo tarde da noite", async () => {
    expect(await slotsVistosAs(23, 50, 1)).toEqual(TODOS);
  });

  test("ontem: nenhum", async () => {
    expect(await slotsVistosAs(9, 0, -1)).toEqual([]);
  });
});
