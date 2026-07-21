import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcoesAgendamento } from "./acoes-agendamento";
import { AdminNav } from "../admin-nav";

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

  const agendamentos = await prisma.agendamento.findMany({
    where: { tenantId: tenant.id },
    include: { usuario: true, veiculo: true, servico: true },
    orderBy: { dataHora: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <AdminNav slug={slug} />
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Painel — Agendamentos
      </h1>

      <ul className="mt-6 space-y-3">
        {agendamentos.map((agendamento) => (
          <li
            key={agendamento.id}
            className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <span>
                {agendamento.dataHora.toLocaleString("pt-BR")} —{" "}
                {agendamento.servico.nome} — {agendamento.usuario.nome} (
                {agendamento.veiculo.marca} {agendamento.veiculo.modelo})
              </span>
              <span className="font-semibold">{agendamento.status}</span>
            </div>
            <AcoesAgendamento
              agendamentoId={agendamento.id}
              status={agendamento.status}
            />
          </li>
        ))}
        {agendamentos.length === 0 && (
          <li className="text-zinc-500">Nenhum agendamento ainda.</li>
        )}
      </ul>
    </div>
  );
}
