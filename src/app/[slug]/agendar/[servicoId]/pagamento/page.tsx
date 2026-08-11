import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ClienteShell } from "../../../cliente-shell";
import { PagamentoForm } from "./pagamento-form";

// Tela 10 — escolha da forma de pagamento. Recebe veiculo/data/hora via
// query e cria o agendamento ao confirmar (via /api/agendamentos).
export default async function PagamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; servicoId: string }>;
  searchParams: Promise<{ veiculoId?: string; data?: string; hora?: string }>;
}) {
  const { slug, servicoId } = await params;
  const { veiculoId, data, hora } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  if (!veiculoId || !data || !hora) {
    redirect(`/${slug}/agendar/${servicoId}`);
  }

  const { servico, veiculo } = await withTenant(tenant.id, async (tx) => {
    const servico = await tx.servico.findFirst({
      where: { id: servicoId, tenantId: tenant.id, ativo: true },
    });
    const veiculo = await tx.veiculo.findFirst({
      where: { id: veiculoId, usuarioId: session.user.id },
    });
    return { servico, veiculo };
  });
  if (!servico || !veiculo) notFound();

  const preco = Number(calcularPreco(servico, veiculo.segmento));

  return (
    <ClienteShell
      slug={slug}
      trilha={["Agendamento", "Pagamento"]}
      titulo="Como prefere pagar?"
    >
      <PagamentoForm
        slug={slug}
        servicoId={servicoId}
        veiculoId={veiculoId}
        data={data}
        hora={hora}
        servico={{ nome: servico.nome, duracaoMin: servico.duracaoMin }}
        veiculo={{
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          placa: veiculo.placa,
          cor: veiculo.cor,
        }}
        segmento={veiculo.segmento}
        preco={preco}
        pixDisponivel={!!tenant.pixChaveCopiaCola}
        cancelamentoHorasLimite={tenant.cancelamentoHorasLimite}
      />
    </ClienteShell>
  );
}
