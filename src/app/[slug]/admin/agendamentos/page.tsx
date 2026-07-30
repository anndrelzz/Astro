import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { AcoesAgendamento } from "./acoes-agendamento";
import { AdminHeader } from "../admin-header";

// RF11, UC10 — painel administrativo com visao geral dos agendamentos.
export default async function AdminAgendamentosPage({
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

  const agendamentos = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findMany({
      where: { tenantId: tenant.id },
      include: { usuario: true, veiculo: true, servico: true },
      orderBy: { dataHora: "asc" },
    })
  );

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <AdminHeader trilha={`Lista · ${hoje}`} titulo="Agendamentos" />

      <ul className="space-y-3">
        {agendamentos.map((agendamento) => (
          <li
            key={agendamento.id}
            className="rounded-xl border border-admin-border bg-admin-surface p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-200">
                {agendamento.dataHora.toLocaleString("pt-BR")} —{" "}
                {agendamento.servico.nome} — {agendamento.usuario.nome} (
                {agendamento.veiculo.marca} {agendamento.veiculo.modelo})
              </span>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-astro-blue-bright">
                {agendamento.status}
              </span>
            </div>
            <AcoesAgendamento
              agendamentoId={agendamento.id}
              status={agendamento.status}
            />
          </li>
        ))}
        {agendamentos.length === 0 && (
          <li className="rounded-xl border border-dashed border-admin-border p-8 text-center text-sm text-astro-muted">
            Nenhum agendamento ainda.
          </li>
        )}
      </ul>
    </>
  );
}
