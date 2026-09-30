import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";
import { segmentoSchema } from "@/lib/validations/segmento";

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
  const parsed = segmentoSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;

  const resultado = await withTenant(tenantId, async (tx) => {
    const segmento = await tx.segmento.findFirst({ where: { id, tenantId } });
    if (!segmento) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    // Renomear e seguro para o historico: o agendamento guarda o valor
    // congelado, e o veiculo aponta pelo id. "Pickup" virar "Picape pequena"
    // muda o rotulo em todo lugar, que e exatamente o esperado.
    if (parsed.data.nome && parsed.data.nome !== segmento.nome) {
      const conflito = await tx.segmento.findFirst({
        where: { tenantId, nome: parsed.data.nome, id: { not: id } },
      });
      if (conflito) {
        return { error: "Ja existe um tipo de veiculo com esse nome", status: 409 } as const;
      }
    }

    const atualizado = await tx.segmento.update({ where: { id }, data: parsed.data });
    return { atualizado } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado.atualizado);
}

// Mesma regra do remover veiculo (RN15), decidida pelo Andre em 29/09, com uma
// diferenca: veiculos apontam para o segmento, entao apagar de verdade exige
// que nem veiculo exista — nao basta nao haver agendamento.
//
//   com agendamento ATIVO      -> 409, nao remove. Ha horario reservado para um
//                                 carro desse tipo; cancelar e decisao do
//                                 cliente, nao efeito de arrumar o catalogo.
//   com veiculo ou historico   -> ativo = false. Sai da escolha e da vitrine;
//                                 o historico do cliente e do Admin continua
//                                 mostrando o rotulo certo.
//   sem nada apontando         -> apagado de verdade (os precos vao junto).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const tenantId = session.user.tenantId;

  const resultado = await withTenant(tenantId, async (tx) => {
    const segmento = await tx.segmento.findFirst({ where: { id, tenantId } });
    if (!segmento) {
      return { error: "Nao encontrado", status: 404 } as const;
    }

    // "Ativo" e por data E status, igual a rota de veiculo: um agendamento
    // ainda por vir que aguarda pagamento tambem ocupa horario na agenda.
    const ativos = await tx.agendamento.count({
      where: {
        tenantId,
        veiculo: { segmentoId: id },
        dataHora: { gte: new Date() },
        status: { notIn: ["CANCELADO", "CONCLUIDO"] },
      },
    });
    if (ativos > 0) {
      return {
        error:
          ativos === 1
            ? "Existe um agendamento futuro de um veiculo desse tipo. Cancele-o antes de remover."
            : `Existem ${ativos} agendamentos futuros de veiculos desse tipo. Cancele-os antes de remover.`,
        status: 409,
      } as const;
    }

    const veiculos = await tx.veiculo.count({ where: { tenantId, segmentoId: id } });
    if (veiculos > 0) {
      await tx.segmento.update({ where: { id }, data: { ativo: false } });
      return { removido: "aposentado" } as const;
    }

    await tx.precoServico.deleteMany({ where: { tenantId, segmentoId: id } });
    await tx.segmento.delete({ where: { id } });
    return { removido: "apagado" } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado);
}
