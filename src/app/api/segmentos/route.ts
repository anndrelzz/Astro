import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";
import { segmentoNovoSchema } from "@/lib/validations/segmento";

// RN01 revisada — o Admin define os tipos de veiculo que a estetica atende.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = segmentoNovoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;
  const { nome, ordem, copiarPrecosDe } = parsed.data;

  const resultado = await withTenant(tenantId, async (tx) => {
    const jaExiste = await tx.segmento.findFirst({ where: { tenantId, nome } });
    if (jaExiste) {
      return { error: "Ja existe um tipo de veiculo com esse nome", status: 409 } as const;
    }

    const segmento = await tx.segmento.create({
      data: { tenantId, nome, ordem },
    });

    // Todo servico precisa de preco para todo segmento ativo. Sem a copia, o
    // catalogo ficaria incompleto no instante seguinte a criacao; com ela, o
    // Admin so ajusta o que difere.
    const modelo = copiarPrecosDe
      ? await tx.precoServico.findMany({ where: { tenantId, segmentoId: copiarPrecosDe } })
      : [];

    if (modelo.length > 0) {
      await tx.precoServico.createMany({
        data: modelo.map((p) => ({
          tenantId,
          servicoId: p.servicoId,
          segmentoId: segmento.id,
          valor: p.valor,
        })),
      });
    } else {
      // Sem segmento de origem (ou origem sem precos): entra zerado em todos os
      // servicos, para nunca existir servico sem linha de preco. A tela sinaliza
      // os zerados como pendentes de ajuste.
      const servicos = await tx.servico.findMany({
        where: { tenantId },
        select: { id: true },
      });
      if (servicos.length > 0) {
        await tx.precoServico.createMany({
          data: servicos.map((s) => ({
            tenantId,
            servicoId: s.id,
            segmentoId: segmento.id,
            valor: 0,
          })),
        });
      }
    }

    return { segmento } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado.segmento, { status: 201 });
}
