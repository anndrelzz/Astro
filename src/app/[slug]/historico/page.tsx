import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoricoLista } from "./historico-lista";

// RF15, UC05 — historico de agendamentos do cliente (tela 13 do mockup).
// O cancelamento (tela 14) e feito por um modal dentro de HistoricoLista.
export default async function HistoricoPage({
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

  const agendamentos = await prisma.agendamento.findMany({
    where: { tenantId: tenant.id, usuarioId: session.user.id },
    include: { servico: true, veiculo: true },
    orderBy: { dataHora: "desc" },
  });

  const itens = agendamentos.map((a) => {
    const horasAte = (a.dataHora.getTime() - Date.now()) / (1000 * 60 * 60);
    const podeCancelar =
      a.status !== "CANCELADO" &&
      a.status !== "CONCLUIDO" &&
      horasAte >= tenant.cancelamentoHorasLimite;

    return {
      id: a.id,
      dataHoraISO: a.dataHora.toISOString(),
      duracaoMin: a.servico.duracaoMin,
      servicoNome: a.servico.nome,
      veiculoMarcaModelo: `${a.veiculo.marca} ${a.veiculo.modelo}`,
      segmento: a.veiculo.segmento,
      valor: Number(a.valor),
      status: a.status,
      podeCancelar,
    };
  });

  return (
    <HistoricoLista
      slug={slug}
      itens={itens}
      horasLimite={tenant.cancelamentoHorasLimite}
    />
  );
}
