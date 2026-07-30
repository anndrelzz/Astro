import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-db";

// UC16, RF06 — Admin confirma manualmente o recebimento.
//
// Vale para as duas formas de pagamento (RF07):
//   PIX_PENDENTE        cliente pagou por PIX, Admin confere no app do banco
//   PENDENTE_PAGAMENTO  cliente paga no local, Admin confirma ao receber
//
// Antes so o PIX podia ser confirmado, e o pagamento no local ficava pendente
// para sempre. Como o dashboard financeiro (RF12) so soma agendamentos
// confirmados, tudo que era recebido em especie ou cartao ficava invisivel no
// relatorio de receita.
const CONFIRMAVEIS = ["PIX_PENDENTE", "PENDENTE_PAGAMENTO"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    const agendamento = await tx.agendamento.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!agendamento) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    if (!CONFIRMAVEIS.includes(agendamento.status as (typeof CONFIRMAVEIS)[number])) {
      return {
        error: "Este agendamento nao esta aguardando pagamento",
        status: 400,
      } as const;
    }

    await tx.agendamento.update({
      where: { id },
      data: { status: "CONFIRMADO" },
    });

    return { ok: true } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado);
}
