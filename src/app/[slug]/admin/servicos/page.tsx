import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ServicosAdmin } from "./servicos-admin";

// UC08, RF01 — Admin gerencia servicos e precos por segmento de veiculo.
export default async function AdminServicosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const { servicos, vendasPorServico } = await withTenant(tenant.id, async (tx) => {
    const servicos = await tx.servico.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });

    // Quantas vezes cada servico foi vendido no mes corrente. Cancelados nao
    // contam — a coluna serve para o Admin ver o que esta girando.
    const vendas = await tx.agendamento.groupBy({
      by: ["servicoId"],
      where: {
        tenantId: tenant.id,
        status: { not: "CANCELADO" },
        dataHora: { gte: inicioMes },
      },
      _count: { _all: true },
    });

    return {
      servicos,
      vendasPorServico: Object.fromEntries(
        vendas.map((v) => [v.servicoId, v._count._all])
      ) as Record<string, number>,
    };
  });

  return (
    <ServicosAdmin
      servicosIniciais={servicos.map((s) => ({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        ativo: s.ativo,
        duracaoMin: s.duracaoMin,
        precoHatch: Number(s.precoHatch),
        precoSedan: Number(s.precoSedan),
        precoSuv: Number(s.precoSuv),
        precoPickup: Number(s.precoPickup),
        precoVan: Number(s.precoVan),
        vendasNoMes: vendasPorServico[s.id] ?? 0,
      }))}
    />
  );
}
