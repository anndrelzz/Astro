import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { FinanceiroDashboard, type Periodo } from "./financeiro-dashboard";

// RF12, UC11 — dashboard financeiro: receita por periodo, por servico e por
// forma de pagamento.
//
// Uma consulta so, agregada em memoria. Com o volume de uma estetica isso e
// mais barato que varios groupBy no banco; se um dia a base crescer a ponto de
// pesar, o caminho e mover a agregacao para SQL, nao paginar aqui.

const PERIODOS: Periodo[] = ["hoje", "7dias", "30dias", "90dias", "ano"];

// RF12 — receita conta apenas o que ja foi confirmado. O que aguarda
// pagamento aparece em separado, nunca somado a receita.
const RECEBIDO = ["CONFIRMADO", "CONCLUIDO"] as const;

function janela(periodo: Periodo) {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  if (periodo === "hoje") {
    // ja esta no inicio de hoje
  } else if (periodo === "7dias") {
    inicio.setDate(inicio.getDate() - 6);
  } else if (periodo === "30dias") {
    inicio.setDate(inicio.getDate() - 29);
  } else if (periodo === "90dias") {
    inicio.setDate(inicio.getDate() - 89);
  } else {
    inicio.setMonth(0, 1);
  }

  return { inicio, fim };
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminFinanceiroPage({
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

  const periodo: Periodo = PERIODOS.includes(periodoBruto as Periodo)
    ? (periodoBruto as Periodo)
    : "30dias";

  const { inicio, fim } = janela(periodo);

  // Periodo anterior de mesma duracao, para a variacao dos indicadores.
  const duracaoMs = fim.getTime() - inicio.getTime();
  const inicioAnterior = new Date(inicio.getTime() - duracaoMs);
  const fimAnterior = new Date(inicio.getTime() - 1);

  const dados = await withTenant(tenant.id, async (tx) => {
    const atual = await tx.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        status: { not: "CANCELADO" },
        dataHora: { gte: inicio, lte: fim },
      },
      include: { servico: true, usuario: true },
      orderBy: { dataHora: "asc" },
    });

    const anterior = await tx.agendamento.aggregate({
      _sum: { valor: true },
      where: {
        tenantId: tenant.id,
        status: { in: [...RECEBIDO] },
        dataHora: { gte: inicioAnterior, lte: fimAnterior },
      },
    });

    return { atual, receitaAnterior: Number(anterior._sum.valor ?? 0) };
  });

  const recebidos = dados.atual.filter((a) =>
    (RECEBIDO as readonly string[]).includes(a.status)
  );

  const receitaTotal = recebidos.reduce((s, a) => s + Number(a.valor), 0);
  const ticketMedio = recebidos.length ? receitaTotal / recebidos.length : 0;

  const recebidoPix = recebidos
    .filter((a) => a.formaPagamento === "PIX")
    .reduce((s, a) => s + Number(a.valor), 0);

  const pendentes = dados.atual.filter(
    (a) => !(RECEBIDO as readonly string[]).includes(a.status)
  );
  const aReceber = pendentes.reduce((s, a) => s + Number(a.valor), 0);

  // Serie diaria: cada dia do periodo, mesmo sem movimento — buraco no meio da
  // serie temporal mentiria sobre o ritmo do negocio.
  const porDia = new Map<string, { recebido: number; pendente: number }>();
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    porDia.set(chaveDia(d), { recebido: 0, pendente: 0 });
  }
  for (const a of dados.atual) {
    const alvo = porDia.get(chaveDia(a.dataHora));
    if (!alvo) continue;
    if ((RECEBIDO as readonly string[]).includes(a.status)) {
      alvo.recebido += Number(a.valor);
    } else {
      alvo.pendente += Number(a.valor);
    }
  }

  const porServico = new Map<string, { nome: string; receita: number; qtd: number }>();
  for (const a of recebidos) {
    const atual = porServico.get(a.servicoId) ?? {
      nome: a.servico.nome,
      receita: 0,
      qtd: 0,
    };
    atual.receita += Number(a.valor);
    atual.qtd += 1;
    porServico.set(a.servicoId, atual);
  }

  const porCliente = new Map<string, { nome: string; receita: number; visitas: number }>();
  for (const a of recebidos) {
    const atual = porCliente.get(a.usuarioId) ?? {
      nome: a.usuario.nome,
      receita: 0,
      visitas: 0,
    };
    atual.receita += Number(a.valor);
    atual.visitas += 1;
    porCliente.set(a.usuarioId, atual);
  }

  const pagamentoPix = recebidos.filter((a) => a.formaPagamento === "PIX").length;
  const pagamentoLocal = recebidos.length - pagamentoPix;

  return (
    <FinanceiroDashboard
      slug={slug}
      periodo={periodo}
      inicioISO={inicio.toISOString()}
      fimISO={fim.toISOString()}
      receitaTotal={receitaTotal}
      receitaAnterior={dados.receitaAnterior}
      ticketMedio={ticketMedio}
      recebidoPix={recebidoPix}
      aReceber={aReceber}
      atendimentos={recebidos.length}
      pendentesQtd={pendentes.length}
      serieDiaria={[...porDia.entries()].map(([dia, v]) => ({ dia, ...v }))}
      porServico={[...porServico.values()].sort((a, b) => b.receita - a.receita)}
      porCliente={[...porCliente.values()]
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 8)}
      pagamentoPix={pagamentoPix}
      pagamentoLocal={pagamentoLocal}
    />
  );
}
