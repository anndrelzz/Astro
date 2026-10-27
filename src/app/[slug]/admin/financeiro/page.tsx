import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { foiRecebido, janela, lerPeriodo, totalCobrado } from "@/lib/financeiro";
import { FUSO, chaveDia, inicioDoDia } from "@/lib/fuso";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { FinanceiroDashboard, type ItemPagamento } from "./financeiro-dashboard";

// RF12, UC11 — dashboard financeiro: receita total, receita por dia, por
// servico, os 5 clientes que mais gastaram e o que ainda falta receber.
//
// Uma consulta so, agregada em memoria. Com o volume de uma estetica isso e
// mais barato que varios groupBy no banco; se um dia a base crescer a ponto de
// pesar, o caminho e mover a agregacao para SQL, nao paginar aqui.

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

  const periodo = lerPeriodo(periodoBruto);
  const { inicio, fim } = janela(periodo);

  const atual = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        status: { not: "CANCELADO" },
        dataHora: { gte: inicio, lte: fim },
      },
      include: { servico: true, usuario: true },
      orderBy: { dataHora: "asc" },
    })
  );

  const recebidos = atual.filter((a) => foiRecebido(a.status));
  const pendentes = atual.filter((a) => !foiRecebido(a.status));

  const receitaTotal = recebidos.reduce((s, a) => s + totalCobrado(a), 0);
  const recebidoPix = recebidos.filter((a) => a.formaPagamento === "PIX").reduce((s, a) => s + totalCobrado(a), 0);
  const aReceber = pendentes.reduce((s, a) => s + Number(a.valor), 0);

  // Serie diaria: cada dia do periodo, mesmo sem movimento — buraco no meio da
  // serie temporal mentiria sobre o ritmo do negocio.
  const porDia = new Map<string, { recebido: number; pendente: number }>();
  for (let i = 0, d = inicio; d <= fim; i++, d = inicioDoDia(inicio, i)) {
    porDia.set(chaveDia(d), { recebido: 0, pendente: 0 });
  }
  for (const a of atual) {
    const alvo = porDia.get(chaveDia(a.dataHora));
    if (!alvo) continue;
    if (foiRecebido(a.status)) alvo.recebido += totalCobrado(a);
    else alvo.pendente += Number(a.valor);
  }

  const porServico = new Map<string, { nome: string; receita: number; qtd: number }>();
  for (const a of recebidos) {
    const item = porServico.get(a.servicoId) ?? { nome: a.servico.nome, receita: 0, qtd: 0 };
    item.receita += totalCobrado(a);
    item.qtd += 1;
    porServico.set(a.servicoId, item);
  }

  const porCliente = new Map<string, { nome: string; receita: number; visitas: number }>();
  for (const a of recebidos) {
    const item = porCliente.get(a.usuarioId) ?? { nome: a.usuario.nome, receita: 0, visitas: 0 };
    item.receita += totalCobrado(a);
    item.visitas += 1;
    porCliente.set(a.usuarioId, item);
  }

  // O que ainda falta entrar, do mais antigo (o que esta atrasado) ao mais novo.
  const hojeChave = chaveDia(new Date());
  const aReceberLista: ItemPagamento[] = pendentes.slice(0, 6).map((a) => ({
    id: a.id,
    dia:
      chaveDia(a.dataHora) === hojeChave
        ? "Hoje"
        : a.dataHora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO }),
    cliente: a.usuario.nome,
    servico: a.servico.nome,
    forma: a.formaPagamento,
    valor: Number(a.valor),
  }));

  return (
    <FinanceiroDashboard
      slug={slug}
      periodo={periodo}
      inicioISO={inicio.toISOString()}
      fimISO={fim.toISOString()}
      receitaTotal={receitaTotal}
      recebidoPix={recebidoPix}
      atendimentos={recebidos.length}
      aReceber={aReceber}
      pendentesQtd={pendentes.length}
      serieDiaria={[...porDia.entries()].map(([dia, v]) => ({ dia, ...v }))}
      porServico={[...porServico.values()].sort((a, b) => b.receita - a.receita)}
      porCliente={[...porCliente.values()].sort((a, b) => b.receita - a.receita).slice(0, 5)}
      aReceberLista={aReceberLista}
    />
  );
}
