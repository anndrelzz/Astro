import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { chaveDia, fimDoDia, inicioDoDia, instanteNoFuso, partesNoFuso } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { FinanceiroDashboard, type Periodo } from "./financeiro-dashboard";
import type { Prisma } from "@/generated/prisma/client";

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

// Dias contados no relogio da estetica (lib/fuso.ts), nao no do servidor.
const DIAS_ATRAS: Record<Exclude<Periodo, "ano">, number> = {
  hoje: 0,
  "7dias": 6,
  "30dias": 29,
  "90dias": 89,
};

// O que entrou de fato: o valor combinado no agendamento mais o acrescimo que o
// Admin lancou na avaliacao presencial. Somar so `valor` fazia o relatorio
// divergir do caixa — uma lavacao combinada por R$ 120,00 e cobrada por
// R$ 156,00 aparecia como R$ 120,00.
function totalCobrado(a: { valor: Prisma.Decimal; acrescimoAplicado: Prisma.Decimal | null }) {
  return Number(a.valor) + Number(a.acrescimoAplicado ?? 0);
}

function janela(periodo: Periodo) {
  const agora = new Date();
  const fim = fimDoDia(agora);

  const inicio =
    periodo === "ano"
      ? instanteNoFuso(partesNoFuso(agora).ano, 1, 1)
      : inicioDoDia(agora, -DIAS_ATRAS[periodo]);

  return { inicio, fim };
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

    // findMany em vez de aggregate: o _sum soma UMA coluna, e a receita agora
    // sao duas (valor + acrescimoAplicado).
    const anteriores = await tx.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: [...RECEBIDO] },
        dataHora: { gte: inicioAnterior, lte: fimAnterior },
      },
      select: { valor: true, acrescimoAplicado: true },
    });

    return {
      atual,
      receitaAnterior: anteriores.reduce((s, a) => s + totalCobrado(a), 0),
    };
  });

  const recebidos = dados.atual.filter((a) =>
    (RECEBIDO as readonly string[]).includes(a.status)
  );

  const receitaTotal = recebidos.reduce((s, a) => s + totalCobrado(a), 0);
  const ticketMedio = recebidos.length ? receitaTotal / recebidos.length : 0;

  const recebidoPix = recebidos
    .filter((a) => a.formaPagamento === "PIX")
    .reduce((s, a) => s + totalCobrado(a), 0);

  const pendentes = dados.atual.filter(
    (a) => !(RECEBIDO as readonly string[]).includes(a.status)
  );
  const aReceber = pendentes.reduce((s, a) => s + Number(a.valor), 0);

  // Serie diaria: cada dia do periodo, mesmo sem movimento — buraco no meio da
  // serie temporal mentiria sobre o ritmo do negocio.
  const porDia = new Map<string, { recebido: number; pendente: number }>();
  for (let i = 0, d = inicio; d <= fim; i++, d = inicioDoDia(inicio, i)) {
    porDia.set(chaveDia(d), { recebido: 0, pendente: 0 });
  }
  for (const a of dados.atual) {
    const alvo = porDia.get(chaveDia(a.dataHora));
    if (!alvo) continue;
    if ((RECEBIDO as readonly string[]).includes(a.status)) {
      alvo.recebido += totalCobrado(a);
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
    atual.receita += totalCobrado(a);
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
    atual.receita += totalCobrado(a);
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
