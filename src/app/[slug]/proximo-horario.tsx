import Link from "next/link";
import { ArrowRight, CalendarClock, Car, Clock } from "lucide-react";
import { chaveDia, FUSO, horaMinuto, inicioDoDia } from "@/lib/fuso";

export type Proximo = {
  id: string;
  dataHora: Date;
  duracaoMin: number;
  servicoNome: string;
  veiculo: string;
  placa: string;
  status: "PENDENTE_PAGAMENTO" | "PIX_PENDENTE" | "CONFIRMADO";
};

// Como o cliente le cada status. "PIX_PENDENTE" quer dizer que ele escolheu
// PIX e a estetica ainda nao conferiu o pagamento no banco (RN05): o atalho
// leva de volta ao codigo, para quem saiu da tela antes de pagar.
const SITUACAO = {
  CONFIRMADO: "Confirmado",
  PIX_PENDENTE: "PIX aguardando confirmação",
  PENDENTE_PAGAMENTO: "Pagamento no local",
} as const;

// Cartao de destaque da home: o proximo horario marcado, no mesmo desenho do
// cartao de faturamento do painel (degrade e aneis da cor da estetica, luz
// girando na borda). So aparece quando ha algo marcado.
export function ProximoHorario({
  slug,
  proximo,
  agora,
}: {
  slug: string;
  proximo: Proximo;
  agora: Date;
}) {
  const inicio = proximo.dataHora;
  const fim = new Date(inicio.getTime() + proximo.duracaoMin * 60000);
  const andando = inicio <= agora;

  const chave = chaveDia(inicio);
  const dia =
    chave === chaveDia(agora)
      ? "Hoje"
      : chave === chaveDia(inicioDoDia(agora, 1))
        ? "Amanhã"
        : inicio.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: FUSO,
          });

  const pix = proximo.status === "PIX_PENDENTE";

  return (
    <section
      aria-label="Seu próximo horário"
      className="borda-viva relative overflow-hidden rounded-3xl p-5 text-white lg:p-6"
      style={{
        backgroundImage:
          "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        boxShadow:
          "0 24px 60px -24px color-mix(in srgb, var(--color-astro-blue) 80%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
      />

      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <CalendarClock className="h-4 w-4" />
          {andando ? "Acontecendo agora" : "Seu próximo horário"}
        </p>

        <p className="mt-3 text-2xl font-bold leading-tight first-letter:uppercase">
          {dia}, {horaMinuto(inicio)}
        </p>
        <p className="mt-1 text-white/85">{proximo.servicoNome}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/75">
          <span className="flex items-center gap-1.5">
            <Car className="h-4 w-4" />
            {proximo.veiculo} · {proximo.placa}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            até {horaMinuto(fim)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-black/25 px-3 py-1.5 text-xs font-semibold">
            {SITUACAO[proximo.status]}
          </span>
          <Link
            href={pix ? `/${slug}/pagamento/${proximo.id}` : `/${slug}/historico`}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            {pix ? "Ver código PIX" : "Ver agendamentos"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
