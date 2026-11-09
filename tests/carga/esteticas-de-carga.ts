// Teste de carga (M5 do RFC; RNF02 e RNF05): cria e apaga as esteticas de
// teste que o k6 usa (tests/carga/agendamento.js).
//
//   npx tsx tests/carga/esteticas-de-carga.ts criar 100   cria zzcarga001..100
//   npx tsx tests/carga/esteticas-de-carga.ts contar      mostra o que existe
//   npx tsx tests/carga/esteticas-de-carga.ts apagar      apaga tudo o que e zzcarga
//
// O banco vem de DATABASE_URL (o .env do computador, ou o da producao, passado
// so no comando). Cada estetica e uma estetica de verdade, criada pela mesma
// funcao do autocadastro: o Admin e os 4 tipos de veiculo, mais um servico de
// 60 minutos com preco para os 4 tipos, a grade de 08:00 as 18:00 nos 7 dias
// e um cliente com um carro. O cliente NAO tem e-mail confirmado nem Telegram:
// os agendamentos do teste nao mandam nenhuma notificacao.
//
// Os ids de cada estetica vao para tests/carga/esteticas.json (fora do git),
// que o script do k6 le.

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { criarEstetica } from "../../src/back/criar-estetica";

export const PREFIXO = "zzcarga";
export const SENHA_DA_CARGA = "Carga2026!";
// Rodar a partir da raiz do projeto.
const ARQUIVO = join(process.cwd(), "tests", "carga", "esteticas.json");

const banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type EsteticaDeCarga = {
  slug: string;
  tenantId: string;
  servicoId: string;
  veiculoId: string;
  email: string;
};

function slugDe(numero: number) {
  return `${PREFIXO}${String(numero).padStart(3, "0")}`;
}

async function criar(quantas: number) {
  const senhaHash = await bcrypt.hash(SENHA_DA_CARGA, 10);
  const criadas: EsteticaDeCarga[] = [];

  for (let numero = 1; numero <= quantas; numero++) {
    const slug = slugDe(numero);
    const { tenant } = await criarEstetica(banco, {
      nomeEstetica: `Carga ${numero}`,
      slug,
      nomeAdmin: `Admin ${slug}`,
      email: `admin@${slug}.carga.local`,
      senhaHash,
      whatsapp: "47999990000",
    });

    const extras = await banco.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      // Capacidade de 3 carros ao mesmo tempo: varios clientes do teste
      // disputam os mesmos horarios, como numa estetica movimentada.
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { pixChaveCopiaCola: "00020126580014br.gov.bcb.pix-carga", capacidadeSimultanea: 3 },
      });
      const segmentos = await tx.segmento.findMany({ where: { tenantId: tenant.id }, orderBy: { ordem: "asc" } });
      const servico = await tx.servico.create({
        data: {
          tenantId: tenant.id,
          nome: "Lavagem completa",
          duracaoMin: 60,
          precos: {
            create: segmentos.map((segmento) => ({ tenantId: tenant.id, segmentoId: segmento.id, valor: 80 })),
          },
        },
      });
      await tx.horarioFuncionamento.createMany({
        data: Array.from({ length: 7 }, (_, diaSemana) => ({
          tenantId: tenant.id,
          diaSemana,
          horaInicioMin: 8 * 60,
          horaFimMin: 18 * 60,
        })),
      });
      const email = `cliente@${slug}.carga.local`;
      const cliente = await tx.usuario.create({
        data: { tenantId: tenant.id, nome: `Cliente ${slug}`, email, telefone: "47999990000", senhaHash, role: "CLIENTE" },
      });
      const veiculo = await tx.veiculo.create({
        data: {
          tenantId: tenant.id,
          usuarioId: cliente.id,
          marca: "Toyota",
          modelo: "Corolla",
          placa: `CRG${String(numero).padStart(4, "0")}`,
          ano: 2022,
          cor: "Prata",
          segmentoId: segmentos[1].id,
        },
      });
      return { servicoId: servico.id, veiculoId: veiculo.id, email };
    });

    criadas.push({ slug, tenantId: tenant.id, ...extras });
    if (numero % 10 === 0) console.log(`${numero}/${quantas} criadas`);
  }

  writeFileSync(ARQUIVO, JSON.stringify({ senha: SENHA_DA_CARGA, esteticas: criadas }, null, 2));
  console.log(`Pronto: ${criadas.length} esteticas. Ids em tests/carga/esteticas.json`);
}

// Conta o que existe de cada estetica de teste, para conferir antes e depois.
async function contar() {
  const tenants = await banco.tenant.findMany({ where: { slug: { startsWith: PREFIXO } }, select: { id: true } });
  let agendamentos = 0;
  let usuarios = 0;
  for (const { id } of tenants) {
    const [a, u] = await banco.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${id}, true)`;
      return [await tx.agendamento.count(), await tx.usuario.count()];
    });
    agendamentos += a;
    usuarios += u;
  }
  console.log({ esteticas: tenants.length, usuarios, agendamentos });
}

// Apaga cada estetica de teste e tudo o que aponta para ela, na ordem das
// chaves estrangeiras (a mesma do removerEstetica dos testes).
async function apagar() {
  const tenants = await banco.tenant.findMany({ where: { slug: { startsWith: PREFIXO } }, select: { id: true } });
  for (const { id: tenantId } of tenants) {
    await banco.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.notificacao.deleteMany({ where: { tenantId } });
      await tx.tokenEmail.deleteMany({ where: { tenantId } });
      await tx.agendamento.deleteMany({ where: { tenantId } });
      await tx.precoServico.deleteMany({ where: { tenantId } });
      await tx.veiculo.deleteMany({ where: { tenantId } });
      await tx.horarioFuncionamento.deleteMany({ where: { tenantId } });
      await tx.usuario.deleteMany({ where: { tenantId } });
      await tx.servico.deleteMany({ where: { tenantId } });
      await tx.segmento.deleteMany({ where: { tenantId } });
    });
    await banco.logoTenant.deleteMany({ where: { tenantId } });
    await banco.tenant.delete({ where: { id: tenantId } });
  }
  console.log(`Apagadas: ${tenants.length} esteticas`);
}

async function main() {
  const [comando, quantidade] = process.argv.slice(2);
  if (comando === "criar") await criar(Number(quantidade ?? 100));
  else if (comando === "contar") await contar();
  else if (comando === "apagar") await apagar();
  else console.log("Use: criar <quantas> | contar | apagar");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
