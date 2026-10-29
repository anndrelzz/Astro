import { getServerSession } from "next-auth";
import { vi } from "vitest";
import { chaveDia } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";

// Ajudantes dos testes das rotas da API. As rotas rodam de verdade, contra um
// PostgreSQL com as migrations aplicadas (o mesmo dos testes de RLS): no
// computador, o banco do .env; no CI, o banco temporario do job.
//
// Cada arquivo de teste cria a sua propria estetica, com um slug que comeca
// por PREFIXO, e apaga tudo no fim. Nada toca nos dados de desenvolvimento.

export const PREFIXO = "__test__rotas";

// Hash bcrypt de "Senha123", para os testes de login.
export const SENHA = "Senha123";
const SENHA_HASH = "$2b$10$eq7sB6dEdo0Qfb8eVTeHvePXvG53ZWi.fCLZtRko2cxsREQO1y5Se";

export type Estetica = Awaited<ReturnType<typeof criarEstetica>>;

// Uma estetica pronta para agendar: aberta todos os dias das 08:00 as 18:00,
// com PIX configurado, um Admin, dois clientes, um tipo de veiculo, um servico
// de 60 minutos a R$ 80,00 e o carro do primeiro cliente.
export async function criarEstetica(nome: string) {
  const slug = `${PREFIXO}-${nome}`;
  await removerEstetica(slug);

  const tenant = await prisma.tenant.create({
    data: {
      nome: `Estetica de teste ${nome}`,
      slug,
      pixChaveCopiaCola: "00020126580014br.gov.bcb.pix-teste",
      cancelamentoHorasLimite: 24,
    },
  });

  return withTenant(tenant.id, async (tx) => {
    const pessoa = (papel: "ADMIN" | "CLIENTE", apelido: string) =>
      tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome: `${apelido} ${nome}`,
          email: `${apelido.toLowerCase()}-${nome}@teste.local`,
          telefone: "47999990000",
          senhaHash: SENHA_HASH,
          role: papel,
        },
      });

    const admin = await pessoa("ADMIN", "Admin");
    const cliente = await pessoa("CLIENTE", "Cliente");
    const outroCliente = await pessoa("CLIENTE", "Outro");

    const segmento = await tx.segmento.create({
      data: { tenantId: tenant.id, nome: "Sedan", ordem: 1 },
    });

    const servico = await tx.servico.create({
      data: {
        tenantId: tenant.id,
        nome: "Lavagem completa",
        duracaoMin: 60,
        precos: { create: [{ tenantId: tenant.id, segmentoId: segmento.id, valor: 80 }] },
      },
    });

    const veiculo = await tx.veiculo.create({
      data: {
        tenantId: tenant.id,
        usuarioId: cliente.id,
        marca: "Toyota",
        modelo: "Corolla",
        placa: "ABC1D23",
        ano: 2022,
        cor: "Prata",
        segmentoId: segmento.id,
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

    return { tenant, admin, cliente, outroCliente, segmento, servico, veiculo };
  });
}

// Apaga a estetica e tudo o que aponta para ela, na ordem das chaves
// estrangeiras. Procura pelo slug, entao tambem limpa sobras de uma execucao
// interrompida.
export async function removerEstetica(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return;
  const tenantId = tenant.id;

  await withTenant(tenantId, async (tx) => {
    await tx.notificacao.deleteMany({ where: { tenantId } });
    await tx.agendamento.deleteMany({ where: { tenantId } });
    await tx.precoServico.deleteMany({ where: { tenantId } });
    await tx.veiculo.deleteMany({ where: { tenantId } });
    await tx.horarioFuncionamento.deleteMany({ where: { tenantId } });
    await tx.usuario.deleteMany({ where: { tenantId } });
    await tx.servico.deleteMany({ where: { tenantId } });
    await tx.segmento.deleteMany({ where: { tenantId } });
  });
  await prisma.logoTenant.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

// Troca a sessao do NextAuth pela do usuario informado; null = ninguem logado.
// O arquivo de teste precisa ter `vi.mock("next-auth", ...)` para isto valer.
export function entrarComo(
  usuario: { id: string; tenantId: string; role: "ADMIN" | "CLIENTE"; nome: string; email: string } | null
) {
  vi.mocked(getServerSession).mockResolvedValue(
    usuario && {
      user: {
        id: usuario.id,
        tenantId: usuario.tenantId,
        role: usuario.role,
        name: usuario.nome,
        email: usuario.email,
      },
      expires: "2099-01-01T00:00:00.000Z",
    }
  );
}

// Pedido HTTP para chamar o handler da rota direto, sem servidor.
export function pedido(metodo: string, url: string, corpo?: unknown) {
  return new Request(`http://localhost${url}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

// Segundo argumento das rotas com [id] no caminho.
export const comId = (id: string) => ({ params: Promise.resolve({ id }) });

// "AAAA-MM-DD" daqui a `dias` dias, no relogio de Brasilia.
export const diaDaqui = (dias: number) => chaveDia(new Date(Date.now() + dias * 24 * 60 * 60 * 1000));

// Instante daqui a `horas` horas.
export const daqui = (horas: number) => new Date(Date.now() + horas * 60 * 60 * 1000);
