import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/back/auth";
import { withTenant } from "@/back/tenant-db";

// "Ja fiz o pagamento" (tela do PIX): o cliente avisa que pagou. Antes o botao
// so trocava de tela e o Admin nao ficava sabendo. Agora a hora do aviso fica
// em agendamento.pagamentoInformadoEm e aparece no painel ("Cliente diz que
// pagou as 14:32"), para o dono saber quais PIX conferir primeiro.
//
// O status nao muda: quem confirma o PIX continua sendo o Admin, depois de
// conferir no banco (RN05). Apertar de novo mantem a hora do primeiro aviso.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    // So o proprio cliente avisa do proprio agendamento. O de outra pessoa
    // responde 404, para nao revelar que ele existe.
    const agendamento = await tx.agendamento.findFirst({
      where: { id, tenantId: session.user.tenantId, usuarioId: session.user.id },
    });
    if (!agendamento) {
      return { error: "Nao encontrado", status: 404 } as const;
    }
    if (agendamento.status !== "PIX_PENDENTE") {
      return { error: "Este agendamento nao esta aguardando PIX", status: 400 } as const;
    }

    if (!agendamento.pagamentoInformadoEm) {
      await tx.agendamento.update({ where: { id }, data: { pagamentoInformadoEm: new Date() } });
    }
    return { ok: true } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  return NextResponse.json(resultado);
}
