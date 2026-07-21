import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopiarPix } from "./copiar-pix";
import { ThemeColor } from "@/components/ui/theme-color";

// Tela 11 — PIX Copia e Cola. QR gerado a partir da propria chave (sem
// gateway). Confirmacao e MANUAL pelo Admin (RFC RN05) — por isso o status
// exibido e "aguardando confirmacao do estabelecimento".
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

  const agendamento = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, tenantId: tenant.id, usuarioId: session.user.id },
  });
  if (!agendamento || !tenant.pixChaveCopiaCola) notFound();

  const chave = tenant.pixChaveCopiaCola;
  const qrDataUrl = await QRCode.toDataURL(chave, { margin: 1, width: 320 });
  const valorFmt = Number(agendamento.valor).toFixed(2).replace(".", ",");
  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh bg-white">
      <ThemeColor color="#0b1120" />
      {/* Cabecalho escuro */}
      <div className="astro-dark px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
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

      <div className="mx-auto -mt-10 max-w-md rounded-t-3xl bg-white px-5 pb-10 pt-6">
        {/* Recebedor */}
        <div className="astro-dark flex items-center justify-between rounded-2xl px-4 py-3">
          <div>
            <p className="astro-label">Recebedor</p>
            <p className="font-semibold text-white">{tenant.nome}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white">
            {iniciais}
          </span>
        </div>

        {/* QR */}
        <div className="mt-4 rounded-2xl border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="astro-label">Valor</p>
              <p className="text-2xl font-bold text-zinc-900">R$ {valorFmt}</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-astro-blue/10 px-3 py-1 text-xs font-medium text-astro-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-astro-blue" />
              PIX pendente
            </span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR Code PIX"
            className="mx-auto mt-4 h-56 w-56 rounded-xl"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Abra o app do seu banco e escaneie o código acima.
          </p>
        </div>

        {/* Copia e cola */}
        <p className="mt-6 astro-label">Ou copie o código</p>
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
    </div>
  );
}
