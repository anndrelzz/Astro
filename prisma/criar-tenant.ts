import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function lerArgs() {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const atual = argv[i];
    if (atual.startsWith("--")) {
      args[atual.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const { nome, slug, email, senha } = lerArgs();

  if (!nome || !slug || !email || !senha) {
    console.error(
      'Uso: npx tsx prisma/criar-tenant.ts --nome "Estetica X" --slug "estetica-x" --email "admin@x.com" --senha "senha-do-admin"'
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.create({ data: { nome, slug } });

  // RLS (migration 20260723_rls) exige app.tenant_id na sessao para escrever
  // em usuario. Script usa conexao unica e sequencial, entao SET de sessao
  // (nao SET LOCAL) e seguro aqui — mesmo padrao do prisma/seed.ts.
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.tenant_id', $1, false)`,
    tenant.id
  );

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome: `Admin ${nome}`,
      email,
      senhaHash,
      role: "ADMIN",
    },
  });

  console.log(`Estetica "${tenant.nome}" criada em /${tenant.slug}`);
  console.log(`Login do admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
