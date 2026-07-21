import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";
import { calcularSlotsDisponiveis } from "@/lib/slots";

const agendamentoSchema = z.object({
  servicoId: z.string().uuid(),
  veiculoId: z.string().uuid(),
  data: z.string(), // YYYY-MM-DD
  hora: z.string(), // HH:mm
  formaPagamento: z.enum(["PIX", "LOCAL"]),
});

// UC03/UC04, RN05 — confirma o agendamento e bloqueia o horario
// imediatamente, independente da forma de pagamento escolhida.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = agendamentoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }
  const { servicoId, veiculoId, data, hora, formaPagamento } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId: session.user.tenantId },
  });
  const veiculo = await prisma.veiculo.findFirst({
    where: { id: veiculoId, usuarioId: session.user.id },
  });
  if (!tenant || !servico || !veiculo) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  // RN10 — PIX so pode ser escolhido se o Admin configurou a chave.
  if (formaPagamento === "PIX" && !tenant.pixChaveCopiaCola) {
    return NextResponse.json({ error: "PIX nao disponivel" }, { status: 400 });
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const dataHora = new Date(ano, mes - 1, dia, h, m);

  // Reconfere disponibilidade no momento da confirmacao (RN06).
  const slotsDisponiveis = await calcularSlotsDisponiveis(tenant, servico, dataHora);
  if (!slotsDisponiveis.includes(hora)) {
    return NextResponse.json(
      { error: "Horario nao esta mais disponivel" },
      { status: 409 }
    );
  }

  const agendamento = await prisma.agendamento.create({
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

  return NextResponse.json(
    { id: agendamento.id, status: agendamento.status, pixChaveCopiaCola: tenant.pixChaveCopiaCola },
    { status: 201 }
  );
}
