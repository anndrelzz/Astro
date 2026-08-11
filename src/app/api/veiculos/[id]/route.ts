import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-db";

// UC02, RN15 — remocao de veiculo do cliente.
//
// Tres desfechos, porque o agendamento aponta para o veiculo e o historico
// nao pode perder o registro do que ja foi vendido:
//
//   - com agendamento FUTURO   -> 409, nao remove. A estetica tem um horario
//                                 reservado esperando este carro; cancelar o
//                                 agendamento e decisao do cliente, nao efeito
//                                 colateral de arrumar a garagem.
//   - com agendamento PASSADO  -> ativo = false. Sai da garagem e da escolha
//                                 no agendamento; o historico segue mostrando.
//   - sem nenhum agendamento   -> apagado de verdade. Nada aponta para ele.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await params;

  return withTenant(session.user.tenantId, async (tx) => {
    // O filtro por usuarioId e a segunda camada: o RLS ja isola por tenant,
    // mas dentro do mesmo tenant um cliente nao pode remover o carro de outro.
    const veiculo = await tx.veiculo.findFirst({
      where: { id, usuarioId: session.user.id },
    });
    if (!veiculo) {
      return NextResponse.json(
        { error: "Veiculo nao encontrado" },
        { status: 404 }
      );
    }

    // "Futuro" e por data, nao por status: um agendamento ainda por vir que
    // esteja aguardando pagamento tambem ocupa o horario na agenda.
    const futuros = await tx.agendamento.count({
      where: {
        veiculoId: id,
        dataHora: { gte: new Date() },
        status: { notIn: ["CANCELADO", "CONCLUIDO"] },
      },
    });
    if (futuros > 0) {
      return NextResponse.json(
        {
          error:
            futuros === 1
              ? "Este veiculo tem um agendamento futuro. Cancele o agendamento antes de remove-lo."
              : `Este veiculo tem ${futuros} agendamentos futuros. Cancele-os antes de remove-lo.`,
        },
        { status: 409 }
      );
    }

    const totais = await tx.agendamento.count({ where: { veiculoId: id } });

    if (totais === 0) {
      await tx.veiculo.delete({ where: { id } });
      return NextResponse.json({ removido: "apagado" });
    }

    await tx.veiculo.update({ where: { id }, data: { ativo: false } });
    return NextResponse.json({ removido: "aposentado" });
  });
}
