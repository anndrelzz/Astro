import { NextResponse } from "next/server";
import { reenviarNotificacoes } from "@/back/notificacoes";
import { verificarEEnviarLembretes } from "@/back/notificacoes/lembretes";

// Endpoint pensado para ser chamado por um agendador externo (Azure
// Scheduler, cron job, etc.) periodicamente. Protegido por segredo simples
// ate existir infra de cron real (M5).
//
// A checagem anterior era `if (process.env.CRON_SECRET && segredo !== ...)`:
// sem a variavel configurada, a condicao inteira era falsa e a rota NUNCA
// recusava ninguem. A ausencia do segredo destrancava a porta em vez de
// tranca-la — e em silencio, respondendo 200 para qualquer chamada. Como a
// rota varre todos os tenants e dispara e-mail, isso e um endpoint publico
// que mexe no dado de todos os clientes.
//
// Agora falha fechada: sem CRON_SECRET, nada roda e a resposta diz por que.
export async function POST(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    // 503 e nao 401: nao e o chamador que esta errado, e o servidor que esta
    // mal configurado. O log deixa o motivo visivel no deploy, em vez de
    // virar um cron que "funciona" sem protecao nenhuma.
    console.error(
      "[cron/lembretes] CRON_SECRET nao configurado - rota recusada por seguranca"
    );
    return NextResponse.json(
      { error: "Cron nao configurado neste ambiente" },
      { status: 503 }
    );
  }

  if (request.headers.get("x-cron-secret") !== esperado) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  // O reenvio vem antes dos lembretes novos: assim um lembrete que falhar
  // nesta rodada so e tentado de novo na proxima, e nao segundos depois.
  const { reenviadas } = await reenviarNotificacoes();
  const lembretes = await verificarEEnviarLembretes();
  return NextResponse.json({ ...lembretes, reenviadas });
}
