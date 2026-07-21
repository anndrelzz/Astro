import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { calcularSlotsDisponiveis } from "@/lib/slots";
import { prisma } from "@/lib/prisma";

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// RF02, RNF02, RN02/RN03 — consulta de slots disponiveis (meta: < 300ms).
// Exige sessao autenticada no proprio tenant, como qualquer outra
// visualizacao de servico/horario.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const servicoId = searchParams.get("servicoId");
  const data = searchParams.get("data"); // formato YYYY-MM-DD

  if (!tenantId || !servicoId || !data) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  if (tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  if (!DATA_REGEX.test(data)) {
    return NextResponse.json(
      { error: "Data invalida - use o formato AAAA-MM-DD" },
      { status: 400 }
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId },
  });
  if (!tenant || !servico) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataConsulta = new Date(ano, mes - 1, dia);
  if (Number.isNaN(dataConsulta.getTime())) {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 });
  }

  const slots = await calcularSlotsDisponiveis(tenant, servico, dataConsulta);

  return NextResponse.json({ slots });
}
