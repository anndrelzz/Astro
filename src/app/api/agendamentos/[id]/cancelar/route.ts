import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// UC06, RN11 — cliente so cancela fora da janela configurada pelo Admin;
// Admin cancela qualquer agendamento sem restricao.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const agendamento = await prisma.agendamento.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { tenant: true },
  });
  if (!agendamento) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  if (agendamento.status === "CANCELADO" || agendamento.status === "CONCLUIDO") {
    return NextResponse.json(
      { error: "Agendamento ja finalizado" },
      { status: 400 }
    );
  }

  if (session.user.role === "CLIENTE") {
    if (agendamento.usuarioId !== session.user.id) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
    }

    const horasAteAgendamento =
      (agendamento.dataHora.getTime() - Date.now()) / (1000 * 60 * 60);

    if (horasAteAgendamento < agendamento.tenant.cancelamentoHorasLimite) {
      return NextResponse.json(
        {
          error:
            "Fora do prazo para cancelamento online. Entre em contato com a estetica diretamente.",
        },
        { status: 403 }
      );
    }
  }

  await prisma.agendamento.update({
    where: { id },
    data: { status: "CANCELADO" },
  });

  return NextResponse.json({ ok: true });
}
