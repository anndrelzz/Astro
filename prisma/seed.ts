import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Estetica de teste — RN09: URL publica em astro.app/[slug]
  const configuracoesTenant = {
    corPrimaria: "#0f172a",
    telefone: "47999990000",
    pixChaveCopiaCola: "00020126360014BR.GOV.BCB.PIX0114+47999990000",
    cancelamentoHorasLimite: 4,
    capacidadeSimultanea: 2,
    intervaloMinutos: 60,
  };

  const tenant = await prisma.tenant.upsert({
    where: { slug: "estetica-teste" },
    update: configuracoesTenant,
    create: {
      ...configuracoesTenant,
      nome: "Estetica do Rafael",
      slug: "estetica-teste",
    },
  });

  // RLS (migration 20260723_rls) exige app.tenant_id na sessao para
  // escrever em usuario/veiculo/servico/agendamento/horario_funcionamento/
  // notificacao. Este script usa uma conexao unica e sequencial (sem
  // pool concorrente), entao SET de sessao (nao SET LOCAL) e seguro aqui.
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.tenant_id', $1, false)`,
    tenant.id
  );

  // Tipos de veiculo (RN01 revisada). Estes sao apenas o ponto de partida de
  // uma estetica nova — ela renomeia, remove e acrescenta pela tela de
  // Catalogo. A EstimaCar, por exemplo, troca Pickup por "Picape pequena" e
  // "Picape grande", e remove Van.
  const segmentosSeed = ["Hatch", "Sedan", "SUV", "Pickup", "Van"];
  const segmentos: { id: string; nome: string }[] = [];
  for (const [ordem, nome] of segmentosSeed.entries()) {
    const existente = await prisma.segmento.findFirst({
      where: { tenantId: tenant.id, nome },
    });
    segmentos.push(
      existente ??
        (await prisma.segmento.create({
          data: { tenantId: tenant.id, nome, ordem },
        }))
    );
  }

  // Preco na ordem dos segmentos acima.
  const servicosSeed = [
    {
      nome: "Lavagem Completa",
      descricao: "Lavagem externa, limpeza de rodas e aplicacao de cera express",
      duracaoMin: 60,
      precos: [60, 70, 90, 100, 120],
    },
    {
      nome: "Polimento Técnico",
      descricao: "Correcao de micro-riscos e revitalizacao da pintura",
      duracaoMin: 180,
      precos: [350, 400, 500, 550, 650],
    },
  ];
  for (const { precos, ...servico } of servicosSeed) {
    const existente = await prisma.servico.findFirst({
      where: { tenantId: tenant.id, nome: servico.nome },
    });
    if (!existente) {
      await prisma.servico.create({
        data: {
          ...servico,
          tenantId: tenant.id,
          precos: {
            create: segmentos.map((s, i) => ({
              tenantId: tenant.id,
              segmentoId: s.id,
              valor: precos[i],
            })),
          },
        },
      });
    }
  }

  // Grade de horarios (RF02): seg-sex 08:00-18:00, sabado 08:00-12:00
  const diasUteis = [1, 2, 3, 4, 5];
  for (const diaSemana of diasUteis) {
    await prisma.horarioFuncionamento.upsert({
      where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana } },
      update: {},
      create: { tenantId: tenant.id, diaSemana, horaInicioMin: 8 * 60, horaFimMin: 18 * 60 },
    });
  }
  await prisma.horarioFuncionamento.upsert({
    where: { tenantId_diaSemana: { tenantId: tenant.id, diaSemana: 6 } },
    update: {},
    create: { tenantId: tenant.id, diaSemana: 6, horaInicioMin: 8 * 60, horaFimMin: 12 * 60 },
  });

  // Admin da estetica (RF02, RF17) — login: admin@teste.com / senha123
  const senhaHash = await bcrypt.hash("senha123", 10);
  await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@teste.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      nome: "Rafael (Admin)",
      email: "admin@teste.com",
      senhaHash,
      role: "ADMIN",
    },
  });

  console.log(`Seed concluido: tenant "${tenant.slug}" pronto em /${tenant.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
