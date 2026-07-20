import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Estetica de teste — RN09: URL publica em astro.app/[slug]
  const tenant = await prisma.tenant.upsert({
    where: { slug: "estetica-teste" },
    update: {},
    create: {
      nome: "Estetica do Rafael",
      slug: "estetica-teste",
      corPrimaria: "#0f172a",
      telefone: "47999990000",
      pixChaveCopiaCola: "00020126360014BR.GOV.BCB.PIX0114+47999990000",
      cancelamentoHorasLimite: 4,
      servicos: {
        create: [
          {
            nome: "Lavagem Completa",
            duracaoMin: 60,
            precoHatch: 60,
            precoSedan: 70,
            precoSuv: 90,
            precoPickup: 100,
            precoVan: 120,
          },
          {
            nome: "Polimento Técnico",
            duracaoMin: 180,
            precoHatch: 350,
            precoSedan: 400,
            precoSuv: 500,
            precoPickup: 550,
            precoVan: 650,
          },
        ],
      },
    },
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
