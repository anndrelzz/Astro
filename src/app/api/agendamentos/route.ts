import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { dispararNotificacao } from "@/lib/notificacoes";
import { calcularPreco } from "@/lib/precificacao";
import { withTenant } from "@/lib/tenant-db";
import { calcularSlotsDisponiveis } from "@/lib/slots";

const agendamentoSchema = z.object({
  servicoId: z.string().uuid(),
  veiculoId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  hora: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horario invalido"),
  formaPagamento: z.enum(["PIX", "LOCAL"]),
});

// UC03/UC04, RN05 — confirma o agendamento e bloqueia o horario
// imediatamente, independente da forma de pagamento escolhida.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = agendamentoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }
  const { servicoId, veiculoId, data, hora, formaPagamento } = parsed.data;

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: session.user.tenantId },
    });
    // RN14 — servico pausado nao pode receber agendamento novo. Agendamentos
    // ja existentes continuam validos: pausar tira da vitrine, nao cancela o
    // que foi vendido.
    const servico = await tx.servico.findFirst({
      where: { id: servicoId, tenantId: session.user.tenantId, ativo: true },
    });
    const veiculo = await tx.veiculo.findFirst({
      where: { id: veiculoId, usuarioId: session.user.id },
    });
    if (!tenant || !servico || !veiculo) {
      return { error: "Nao encontrado", httpStatus: 404 } as const;
    }

    // RN10 — PIX so pode ser escolhido se o Admin configurou a chave.
    if (formaPagamento === "PIX" && !tenant.pixChaveCopiaCola) {
      return { error: "PIX nao disponivel", httpStatus: 400 } as const;
    }

    const [ano, mes, dia] = data.split("-").map(Number);
    const [h, m] = hora.split(":").map(Number);
    const dataHora = new Date(ano, mes - 1, dia, h, m);

    // Reconfere disponibilidade no momento da confirmacao (RN06).
    const slotsDisponiveis = await calcularSlotsDisponiveis(tx, tenant, servico, dataHora);
    if (!slotsDisponiveis.includes(hora)) {
      return { error: "Horario nao esta mais disponivel", httpStatus: 409 } as const;
    }

    const agendamento = await tx.agendamento.create({
      data: {
        tenantId: tenant.id,
        usuarioId: session.user.id,
        veiculoId: veiculo.id,
        servicoId: servico.id,
        dataHora,
        formaPagamento,
        status: formaPagamento === "PIX" ? "PIX_PENDENTE" : "PENDENTE_PAGAMENTO",
        valor: calcularPreco(servico, veiculo.segmento),
      },
    });

    // RF08, Gatilho 1 (secao 3.4) — disparada imediatamente apos confirmacao.
    await dispararNotificacao(tx, agendamento.id, "CONFIRMACAO_AGENDAMENTO");

    return {
      id: agendamento.id,
      status: agendamento.status,
      pixChaveCopiaCola: tenant.pixChaveCopiaCola,
    } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.httpStatus });
  }

  return NextResponse.json(resultado, { status: 201 });
}
