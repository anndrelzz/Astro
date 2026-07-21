import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ThemeColor } from "@/components/ui/theme-color";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const MESES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const BADGE: Record<string, string> = {
  CONFIRMADO: "Pagamento aprovado",
  CONCLUIDO: "Serviço concluído",
  PIX_PENDENTE: "PIX pendente",
  PENDENTE_PAGAMENTO: "Agendamento reservado",
};

// Tela 12 — confirmacao. Badge reflete o status real (fiel ao RFC: PIX e
// confirmado manualmente pelo Admin, entao aqui pode aparecer "PIX pendente").
export default async function ConfirmadoPage({
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
    include: { servico: true, veiculo: true },
  });
  if (!agendamento) notFound();

  const d = agendamento.dataHora;
  const fim = new Date(d.getTime() + agendamento.servico.duracaoMin * 60000);
  const hhmm = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="astro-dark relative min-h-dvh overflow-hidden px-5 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <ThemeColor color="#0b1120" />
      {/* Estrelas decorativas */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <span className="absolute left-[20%] top-[22%] text-white/40">✦</span>
        <span className="absolute right-[24%] top-[18%] text-white/30">✦</span>
        <span className="absolute left-[16%] top-[46%] text-white/20">✦</span>
        <span className="absolute right-[18%] top-[52%] text-white/30">✦</span>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center">
        <span className="flex items-center gap-2 rounded-full border border-astro-blue/30 bg-astro-blue/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-astro-blue-bright">
          <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />
          {BADGE[agendamento.status] ?? "Agendamento"}
        </span>

        <div className="mt-10 flex h-24 w-24 items-center justify-center rounded-full bg-astro-blue shadow-[0_0_60px] shadow-astro-blue/50">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>

        <h1 className="mt-8 text-center text-3xl font-bold text-white">
          Agendamento
          <br />
          <span className="italic text-astro-blue-bright">confirmado</span>
        </h1>
        <p className="mt-3 text-center text-sm text-astro-muted">
          Enviamos os detalhes para o seu e-mail.
        </p>

        {/* Card de data */}
        <div className="mt-8 flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col items-center rounded-xl bg-astro-blue px-3 py-2 text-white">
            <span className="text-[0.55rem] font-medium uppercase">
              {MESES[d.getMonth()]} {d.getFullYear()}
            </span>
            <span className="text-2xl font-bold leading-none">{d.getDate()}</span>
            <span className="text-[0.55rem] uppercase">{DIAS[d.getDay()]}</span>
          </div>
          <div>
            <p className="astro-label">Data e horário</p>
            <p className="font-semibold text-white">
              {d.getDate()} de {MESES_LONGO[d.getMonth()]}
            </p>
            <p className="text-sm text-astro-muted">
              {hhmm(d)} – {hhmm(fim)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="astro-label">Serviço</p>
            <p className="mt-1 font-semibold text-white">{agendamento.servico.nome}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="astro-label">Veículo</p>
            <p className="mt-1 font-semibold text-white">
              {agendamento.veiculo.modelo} · {agendamento.veiculo.segmento}
            </p>
          </div>
        </div>

        <div className="mt-auto w-full space-y-3 pt-10">
          <Link
            href={`/${slug}/historico`}
            className="flex w-full items-center justify-between rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-astro-bg"
          >
            <span className="flex-1 text-center">Ver detalhes</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-astro-bg text-white">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link
            href={`/${slug}`}
            className="flex w-full items-center justify-center rounded-xl border border-white/10 py-3.5 text-sm font-medium text-astro-muted"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
