import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CancelarAgendamento } from "./cancelar-agendamento";

// RF15, UC05 — historico de agendamentos do cliente autenticado.
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

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Meus agendamentos
      </h1>

      <ul className="mt-6 space-y-3">
        {agendamentos.map((agendamento) => {
          const horasAte =
            (agendamento.dataHora.getTime() - Date.now()) / (1000 * 60 * 60);
          const podeCancal =
            agendamento.status !== "CANCELADO" &&
            agendamento.status !== "CONCLUIDO" &&
            horasAte >= tenant.cancelamentoHorasLimite;

          return (
            <li
              key={agendamento.id}
              className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <span>
                  {agendamento.dataHora.toLocaleString("pt-BR")} —{" "}
                  {agendamento.servico.nome} — {agendamento.veiculo.marca}{" "}
                  {agendamento.veiculo.modelo}
                </span>
                <span className="font-semibold">{agendamento.status}</span>
              </div>
              {agendamento.status !== "CANCELADO" &&
                agendamento.status !== "CONCLUIDO" && (
                  <div className="mt-2">
                    {podeCancal ? (
                      <CancelarAgendamento agendamentoId={agendamento.id} />
                    ) : (
                      <span className="text-xs text-zinc-500">
                        Fora do prazo para cancelar online (min.{" "}
                        {tenant.cancelamentoHorasLimite}h de antecedencia) —
                        contate a estetica.
                      </span>
                    )}
                  </div>
                )}
            </li>
          );
        })}
        {agendamentos.length === 0 && (
          <li className="text-zinc-500">Nenhum agendamento ainda.</li>
        )}
      </ul>
    </div>
  );
}
