import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarClock, Car, Clock } from "lucide-react";
import { chaveDia, FUSO, horaMinuto, inicioDoDia } from "@/lib/fuso";

export type Marcado = {
  id: string;
  dataHora: Date;
  duracaoMin: number;
  servicoId: string;
  servicoNome: string;
  // Servico pausado pela estetica (RN14) nao pode ser agendado de novo.
  servicoAtivo: boolean;
  veiculo: string;
  placa: string;
  status: "PENDENTE_PAGAMENTO" | "PIX_PENDENTE" | "CONFIRMADO" | "CONCLUIDO";
};

// Como o cliente le cada status. "PIX_PENDENTE" quer dizer que ele escolheu
// PIX e a estetica ainda nao conferiu o pagamento no banco (RN05): o atalho
// leva de volta ao codigo, para quem saiu da tela antes de pagar.
const SITUACAO = {
  CONFIRMADO: "Confirmado",
  PIX_PENDENTE: "PIX aguardando confirmação",
  PENDENTE_PAGAMENTO: "Pagamento no local",
  CONCLUIDO: "Concluído",
} as const;

// O dia da semana so ajuda no que esta por vir; no que ja passou, a data basta.
function rotuloDia(d: Date, agora: Date, comSemana: boolean) {
  const chave = chaveDia(d);
  if (chave === chaveDia(agora)) return "Hoje";
  if (chave === chaveDia(inicioDoDia(agora, 1))) return "Amanhã";
  if (chave === chaveDia(inicioDoDia(agora, -1))) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    weekday: comSemana ? "long" : undefined,
    day: "numeric",
    month: "long",
    timeZone: FUSO,
  });
}

// Cartao de destaque da home, no mesmo desenho do cartao de faturamento do
// painel (degrade e aneis da cor da estetica).
//
// - "proximo": o proximo horario marcado, com a luz girando na borda e o
//   atalho para o PIX ou para os agendamentos.
// - "ultimo": quem nao tem nada marcado ve o ultimo servico feito, com o
//   atalho para agendar o mesmo de novo — e o caminho mais curto para quem
//   lava o carro sempre do mesmo jeito.
export function ProximoHorario({
  slug,
  marcado,
  modo,
  agora,
}: {
  slug: string;
  marcado: Marcado;
  modo: "proximo" | "ultimo";
  agora: Date;
}) {
  const inicio = marcado.dataHora;
  const fim = new Date(inicio.getTime() + marcado.duracaoMin * 60000);
  const proximo = modo === "proximo";
  const andando = proximo && inicio <= agora;
  const pix = proximo && marcado.status === "PIX_PENDENTE";

  const titulo = andando ? "Acontecendo agora" : proximo ? "Seu próximo horário" : "Seu último serviço";
  const Icone = proximo ? CalendarClock : CalendarCheck;

  let atalho: { href: string; texto: string } | null = null;
  if (pix) atalho = { href: `/${slug}/pagamento/${marcado.id}`, texto: "Ver código PIX" };
  else if (proximo) atalho = { href: `/${slug}/historico`, texto: "Ver agendamentos" };
  else if (marcado.servicoAtivo) atalho = { href: `/${slug}/agendar/${marcado.servicoId}`, texto: "Agendar de novo" };

  return (
    <section
      aria-label={titulo}
      className={`relative overflow-hidden rounded-3xl p-5 text-white lg:p-6 ${proximo ? "borda-viva" : ""}`}
      style={{
        backgroundImage:
          "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        boxShadow: "0 24px 50px -28px color-mix(in srgb, var(--color-astro-blue) 90%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
      />

      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <Icone className="h-4 w-4" />
          {titulo}
        </p>

        <p className="mt-3 text-2xl font-bold leading-tight first-letter:uppercase">
          {rotuloDia(inicio, agora, proximo)}, {horaMinuto(inicio)}
        </p>
        <p className="mt-1 text-white/85">{marcado.servicoNome}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/75">
          <span className="flex items-center gap-1.5">
            <Car className="h-4 w-4" />
            {marcado.veiculo} · {marcado.placa}
          </span>
          {proximo && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              até {horaMinuto(fim)}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-black/25 px-3 py-1.5 text-xs font-semibold">
            {SITUACAO[marcado.status]}
          </span>
          {atalho && (
            <Link
              href={atalho.href}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              {atalho.texto}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
