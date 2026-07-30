import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { AdminHeader } from "../admin-header";
import { AgendamentosLista, type Periodo } from "./agendamentos-lista";

// RF11, UC10 — painel administrativo com visao geral dos agendamentos.
//
// O periodo e filtrado no SERVIDOR (via query string), porque e ele que limita
// quanto sai do banco. Abas, busca e paginacao rodam no cliente, sobre o
// conjunto ja carregado, para responderem sem ida e volta ao servidor.

const PERIODOS: Periodo[] = ["hoje", "7dias", "mes", "todos"];

function janelaDoPeriodo(periodo: Periodo) {
  if (periodo === "todos") return undefined;

  const agora = new Date();
  const inicio = new Date(agora);

  if (periodo === "hoje") {
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(agora);
    fim.setHours(23, 59, 59, 999);
    return { gte: inicio, lte: fim };
  }

  if (periodo === "7dias") {
    inicio.setDate(agora.getDate() - 7);
  } else {
    inicio.setDate(1); // mes corrente
  }
  inicio.setHours(0, 0, 0, 0);

  // Sem limite superior: o Admin precisa enxergar o que ainda vai acontecer,
  // nao apenas o que ja passou.
  return { gte: inicio };
}

export default async function AdminAgendamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { slug } = await params;
  const { periodo: periodoBruto } = await searchParams;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  // Padrao "mes": mostra o movimento recente sem carregar o historico inteiro.
  const periodo: Periodo = PERIODOS.includes(periodoBruto as Periodo)
    ? (periodoBruto as Periodo)
    : "mes";

  const dataHora = janelaDoPeriodo(periodo);

  const agendamentos = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findMany({
      where: { tenantId: tenant.id, ...(dataHora ? { dataHora } : {}) },
      include: { usuario: true, veiculo: true, servico: true },
      orderBy: { dataHora: "desc" },
    })
  );

  const itens = agendamentos.map((a) => ({
    id: a.id,
    dataHoraISO: a.dataHora.toISOString(),
    duracaoMin: a.servico.duracaoMin,
    clienteNome: a.usuario.nome,
    clienteTelefone: a.usuario.telefone ?? "",
    veiculo: `${a.veiculo.marca} ${a.veiculo.modelo} ${a.veiculo.ano}`,
    placa: a.veiculo.placa,
    servicoNome: a.servico.nome,
    valor: Number(a.valor),
    status: a.status,
  }));

  return (
    <>
      <AdminHeader trilha="Lista" titulo="Agendamentos" />
      <AgendamentosLista slug={slug} itens={itens} periodo={periodo} />
    </>
  );
}
