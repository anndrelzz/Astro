import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// RF12, UC11 — dashboard financeiro com receita por periodo e por servico.
// So conta agendamentos com pagamento confirmado (CONFIRMADO/CONCLUIDO);
// PIX pendente, pendente pagamento e cancelado nao entram na receita.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  if (!inicio || !fim) {
    return NextResponse.json({ error: "Informe inicio e fim" }, { status: 400 });
  }

  const [anoI, mesI, diaI] = inicio.split("-").map(Number);
  const [anoF, mesF, diaF] = fim.split("-").map(Number);
  const dataInicio = new Date(anoI, mesI - 1, diaI, 0, 0, 0);
  const dataFim = new Date(anoF, mesF - 1, diaF, 23, 59, 59);

  const where = {
    tenantId: session.user.tenantId,
    status: { in: ["CONFIRMADO", "CONCLUIDO"] as ("CONFIRMADO" | "CONCLUIDO")[] },
    dataHora: { gte: dataInicio, lte: dataFim },
  };

  const agregadoPorServico = await prisma.agendamento.groupBy({
    by: ["servicoId"],
    where,
    _sum: { valor: true },
    _count: { _all: true },
  });

  const servicos = await prisma.servico.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, nome: true },
  });
  const nomePorServico = Object.fromEntries(servicos.map((s) => [s.id, s.nome]));

  const porServico = agregadoPorServico
    .map((item) => ({
      servicoId: item.servicoId,
      nome: nomePorServico[item.servicoId] ?? "Servico removido",
      receita: Number(item._sum.valor ?? 0),
      quantidade: item._count._all,
    }))
    .sort((a, b) => b.receita - a.receita);

  const receitaTotal = porServico.reduce((soma, item) => soma + item.receita, 0);
  const totalAgendamentos = porServico.reduce((soma, item) => soma + item.quantidade, 0);

  return NextResponse.json({ receitaTotal, totalAgendamentos, porServico });
}
