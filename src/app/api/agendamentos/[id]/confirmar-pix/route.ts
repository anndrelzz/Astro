import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-db";

// UC16, RF06 — Admin confirma manualmente o pagamento PIX apos verificar
// o recebimento no app do banco.
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
    if (agendamento.status !== "PIX_PENDENTE") {
      return { error: "Agendamento nao esta com PIX pendente", status: 400 } as const;
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
