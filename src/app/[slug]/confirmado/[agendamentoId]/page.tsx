import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ConfirmadoCliente } from "./confirmado-cliente";

// Tela 12 — confirmacao. O servidor le a sessao e os dados do agendamento; a
// parte visual (com a animacao de sucesso antes) vive no ConfirmadoCliente.
export default async function ConfirmadoPage({
  params,
}: {
  params: Promise<{ slug: string; agendamentoId: string }>;
}) {
  const { slug, agendamentoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  const agendamento = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findFirst({
      where: { id: agendamentoId, tenantId: tenant.id, usuarioId: session.user.id },
      include: { servico: true, veiculo: true },
    })
  );
  if (!agendamento) notFound();

  return (
    <ConfirmadoCliente
      slug={slug}
      agendamentoId={agendamento.id}
      status={agendamento.status}
      estetica={tenant.nome}
      servico={agendamento.servico.nome}
      veiculo={`${agendamento.veiculo.modelo} · ${agendamento.veiculo.segmento}`}
      dataISO={agendamento.dataHora.toISOString()}
      duracaoMin={agendamento.servico.duracaoMin}
      formaPagamento={agendamento.formaPagamento}
      valor={Number(agendamento.valor)}
    />
  );
}
