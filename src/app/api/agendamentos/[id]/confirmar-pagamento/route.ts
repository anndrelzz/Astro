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
// Recebe o acrescimo EM REAIS, nao em percentual. A tela deixa o Admin digitar
// pelos dois lados, e na pratica ele digita o total: ninguem na correria pensa
// "isso e 20%", pensa "cobrei 180". Se o servidor recalculasse a partir de um
// percentual, um total de R$ 175,00 sobre R$ 150,00 viraria 16,666...% e a
// volta devolveria R$ 174,99 — ele digitou 175, tem que gravar 175.
//
// O que protege nao e o formato e sim o teto, conferido aqui contra o valor do
// agendamento que esta no banco: o acrescimo nao pode passar de 100% dele.
// Acima disso seria outro servico, e um dedo escorregado nao pode dobrar a
// cobranca. Nao limitamos ao percentual que a estetica configurou — quem esta
// na frente do carro e o Admin — mas a tela mostra o que foi prometido ao
// cliente para a decisao ser consciente.
const corpoSchema = z.object({
  acrescimo: z.coerce.number().min(0),
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
  const acrescimoInformado = parsed?.success ? parsed.data.acrescimo : 0;

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

    // Teto conferido contra o valor que esta no banco, nao contra um numero
    // que veio junto no corpo.
    if (acrescimoInformado > Number(agendamento.valor)) {
      return {
        error: "O acrescimo nao pode passar do valor do servico",
        status: 400,
      } as const;
    }

    const acrescimo = acrescimoInformado > 0 ? acrescimoInformado : null;

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
