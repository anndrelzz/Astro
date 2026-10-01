import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";

// O Admin pode lancar um acrescimo por condicao do veiculo no momento em que
// confirma o recebimento (avaliacao presencial). O corpo e opcional: sem ele,
// confirma pelo valor combinado, como antes.
//
// Teto de 100% pelo mesmo motivo do percentual configurado: acima disso o
// "acrescimo" seria outro servico, e um dedo escorregado nao pode dobrar a
// cobranca. Nao limitamos ao percentual que a estetica configurou — quem esta
// na frente do carro e o Admin — mas a tela mostra o que foi prometido ao
// cliente para a decisao ser consciente.
const corpoSchema = z.object({
  acrescimoPercent: z.coerce.number().min(0).max(100),
});

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

  // Corpo ausente ou invalido = confirmar sem acrescimo. Nao e erro: a maioria
  // das confirmacoes nao tem acrescimo, e a rota e chamada sem corpo nesse caso.
  const corpo = await lerJson(request);
  const parsed = corpo === null ? null : corpoSchema.safeParse(corpo);
  if (parsed && !parsed.success) {
    return NextResponse.json({ error: "Acrescimo invalido" }, { status: 400 });
  }
  const acrescimoPercent = parsed?.success ? parsed.data.acrescimoPercent : 0;

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

    // O acrescimo e calculado aqui, a partir do `valor` que esta no banco — a
    // tela manda o percentual, nao o valor em reais. Se mandasse reais, a
    // cobranca passaria a depender de um numero digitado no navegador.
    const acrescimo =
      acrescimoPercent > 0
        ? Number(agendamento.valor) * (acrescimoPercent / 100)
        : null;

    await tx.agendamento.update({
      where: { id },
      data: {
        status: "CONFIRMADO",
        // `valor` nao e tocado: continua sendo o combinado no agendamento (RN01).
        acrescimoAplicado: acrescimo,
      },
    });

    return { ok: true, acrescimoAplicado: acrescimo } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado);
}
