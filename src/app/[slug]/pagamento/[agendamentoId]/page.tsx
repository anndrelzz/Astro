import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ClienteShell } from "../../cliente-shell";
import { CopiarPix } from "./copiar-pix";
import { ThemeColor } from "@/components/ui/theme-color";

// Tela 11 — PIX Copia e Cola (RN10, UC04, UC13: apenas a chave copia-e-cola,
// sem QR nem gateway). Confirmacao e MANUAL pelo Admin (RN05) — por isso o
// status exibido e "aguardando confirmacao do estabelecimento", sem prazo de
// expiracao (nao ha gateway real para expirar algo).
export default async function PixPage({
  params,
}: {
  params: Promise<{ slug: string; agendamentoId: string }>;
}) {
  const { slug, agendamentoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  const agendamento = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findFirst({
      where: { id: agendamentoId, tenantId: tenant.id, usuarioId: session.user.id },
    })
  );
  if (!agendamento || !tenant.pixChaveCopiaCola) notFound();

  const chave = tenant.pixChaveCopiaCola;
  const valorFmt = Number(agendamento.valor).toFixed(2).replace(".", ",");
  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <ClienteShell slug={slug} trilha={["Agendamento", "Pagamento", "PIX"]} titulo="Pagar com PIX">
      <div className="min-h-dvh bg-white lg:min-h-0 lg:bg-transparent">
        <ThemeColor color="#0b1120" />
        {/* Cabecalho escuro — so no celular. */}
        <div className="astro-dark px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <Link
              href={`/${slug}`}
              aria-label="Voltar"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-semibold text-white">Pagar com PIX</h1>
            <span className="h-11 w-11" />
          </div>
        </div>

        {/* Coluna unica no celular; pagamento a esquerda e instrucoes a direita
            no desktop (tela 11 do mockup). O QR Code do desenho nao existe aqui:
            sem gateway, so ha a chave copia-e-cola (RN10). */}
        <div className="mx-auto -mt-10 max-w-md rounded-t-3xl bg-white px-5 pb-10 pt-6 lg:mx-0 lg:mt-0 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:rounded-none lg:bg-transparent lg:px-8 lg:pt-0">
          <div className="lg:rounded-2xl lg:border lg:border-zinc-100 lg:bg-white lg:p-8 lg:shadow-sm">
            {/* Recebedor — no desktop ele tem cartao proprio na direita. */}
            <div className="astro-dark flex items-center justify-between rounded-2xl px-4 py-3 lg:hidden">
              <div>
                <p className="astro-label">Recebedor</p>
                <p className="font-semibold text-white">{tenant.nome}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white">
                {iniciais}
              </span>
            </div>

            {/* Valor + status */}
            <div className="mt-4 rounded-2xl border border-zinc-100 p-5 shadow-sm lg:mt-0 lg:border-0 lg:p-0 lg:shadow-none">
              <div className="flex items-center justify-between lg:flex-col lg:gap-3">
                <div className="lg:order-2 lg:text-center">
                  <p className="astro-label lg:hidden">Valor</p>
                  <p className="astro-label hidden lg:block">
                    Pague no app do seu banco
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 lg:mt-1 lg:text-3xl">
                    R$ {valorFmt} <span className="hidden lg:inline">via PIX</span>
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-astro-blue/10 px-3 py-1 text-xs font-medium text-astro-blue lg:order-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-astro-blue" />
                  PIX pendente
                </span>
              </div>
              <p className="mt-3 text-center text-sm text-zinc-500 lg:hidden">
                Copie o código Copia e Cola abaixo e pague no app do seu banco.
              </p>
            </div>

            {/* Copia e cola */}
            <p className="mt-6 astro-label lg:text-center">Código Copia e Cola</p>
            <CopiarPix codigo={chave} />

            {/* Status manual (fiel ao RFC) */}
            <p className="mt-6 rounded-xl bg-astro-blue/5 px-4 py-3 text-center text-sm text-astro-blue">
              Assim que a estética confirmar o recebimento, seu horário está
              garantido.
            </p>

            <Link
              href={`/${slug}/confirmado/${agendamento.id}`}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25"
            >
              Já fiz o pagamento
            </Link>
          </div>

          {/* Recebedor + como pagar — so no desktop. */}
          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              <p className="astro-label">Recebedor</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-astro-bg text-xs font-semibold text-white">
                  {iniciais}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900">{tenant.nome}</p>
                  <p className="truncate text-xs text-zinc-500">
                    Confirmação manual do recebimento
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
              <p className="astro-label">Como pagar</p>
              <p className="mt-1 font-semibold text-zinc-900">3 passos rápidos</p>
              <ol className="mt-4 space-y-3">
                {[
                  "Toque em Copiar e abra o app do seu banco.",
                  'Escolha "PIX Copia e Cola" e cole o código.',
                  "Confirme o pagamento e volte aqui para avisar.",
                ].map((passo, i) => (
                  <li key={passo} className="flex gap-3 text-sm text-zinc-600">
                    <span
                      className={
                        i === 0
                          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-astro-blue text-xs font-semibold text-white"
                          : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500"
                      }
                    >
                      {i + 1}
                    </span>
                    {passo}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </ClienteShell>
  );
}
