import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dispararNotificacao } from "@/lib/notificacoes";
import { withTenant } from "@/lib/tenant-db";

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

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    const agendamento = await tx.agendamento.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { tenant: true },
    });
    if (!agendamento) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    if (agendamento.status === "CANCELADO" || agendamento.status === "CONCLUIDO") {
      return { error: "Agendamento ja finalizado", status: 400 } as const;
    }

    if (session.user.role === "CLIENTE") {
      if (agendamento.usuarioId !== session.user.id) {
        return { error: "Nao autorizado", status: 403 } as const;
      }

      const horasAteAgendamento =
        (agendamento.dataHora.getTime() - Date.now()) / (1000 * 60 * 60);

      if (horasAteAgendamento < agendamento.tenant.cancelamentoHorasLimite) {
        return {
          error:
            "Fora do prazo para cancelamento online. Entre em contato com a estetica diretamente.",
          status: 403,
        } as const;
      }
    }

    await tx.agendamento.update({
      where: { id },
      data: { status: "CANCELADO" },
    });

    // Gatilho 4 (secao 3.4) — disparada imediatamente apos o cancelamento.
    await dispararNotificacao(tx, id, "CONFIRMACAO_CANCELAMENTO");

    return { ok: true } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado);
}
