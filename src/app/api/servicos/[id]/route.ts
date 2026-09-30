import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";
import { validarPrecosCompletos } from "@/lib/catalogo";
import { servicoSchema } from "@/lib/validations/servico";

// UC08 — edicao e remocao de servico, restrito ao Admin da propria estetica.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = servicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;
  const { precos, ...dadosServico } = parsed.data;

  const resultado = await withTenant(tenantId, async (tx) => {
    const servico = await tx.servico.findFirst({ where: { id, tenantId } });
    if (!servico) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    const problema = await validarPrecosCompletos(tx, tenantId, precos);
    if (problema) return { error: problema, status: 400 } as const;

    const atualizado = await tx.servico.update({
      where: { id },
      data: dadosServico,
    });

    // upsert em vez de apagar-e-recriar: o preco tem id proprio e apagar
    // invalidaria referencias a toa. Um segmento aposentado depois da ultima
    // edicao continua com sua linha antiga, que e o que o historico espera.
    for (const p of precos) {
      await tx.precoServico.upsert({
        where: { servicoId_segmentoId: { servicoId: id, segmentoId: p.segmentoId } },
        update: { valor: p.valor },
        create: { tenantId, servicoId: id, segmentoId: p.segmentoId, valor: p.valor },
      });
    }

    return { atualizado } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado.atualizado);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    const servico = await tx.servico.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!servico) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    const agendamentosVinculados = await tx.agendamento.count({
      where: { servicoId: id },
    });
    if (agendamentosVinculados > 0) {
      return {
        error: "Servico possui agendamentos vinculados e nao pode ser removido",
        status: 409,
      } as const;
    }

    await tx.servico.delete({ where: { id } });
    return { ok: true } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado);
}
