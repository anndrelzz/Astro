import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgendamentoForm } from "./agendamento-form";

// UC03 (continuacao) — selecao de data/horario e forma de pagamento,
// apos veiculo ja selecionado na etapa anterior.
export default async function SelecaoHorarioPage({
  params,
}: {
  params: Promise<{ slug: string; servicoId: string; veiculoId: string }>;
}) {
  const { slug, servicoId, veiculoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId: tenant.id },
  });
  const veiculo = await prisma.veiculo.findFirst({
    where: { id: veiculoId, usuarioId: session.user.id },
  });
  if (!servico || !veiculo) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {servico.nome} — {veiculo.marca} {veiculo.modelo}
      </h1>

      <AgendamentoForm
        slug={slug}
        tenantId={tenant.id}
        servicoId={servico.id}
        veiculoId={veiculo.id}
        pixDisponivel={!!tenant.pixChaveCopiaCola}
      />
    </div>
  );
}
