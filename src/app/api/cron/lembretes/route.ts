import { NextResponse } from "next/server";
import { verificarEEnviarLembretes } from "@/lib/notificacoes/lembretes";

// Endpoint pensado para ser chamado por um agendador externo (Azure
// Scheduler, cron job, etc.) periodicamente. Protegido por segredo simples
// ate existir infra de cron real (M5).
export async function POST(request: Request) {
  const segredo = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const resultado = await verificarEEnviarLembretes();
  return NextResponse.json(resultado);
}
