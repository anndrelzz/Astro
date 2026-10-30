import type { StatusAgendamento } from "@/generated/prisma/enums";

// Agenda de hoje do Dashboard em linha do tempo: as horas na coluna da
// esquerda e cada agendamento como um bloco na altura e no tamanho do horario
// dele. A linha vermelha marca "agora". O que ja terminou fica apagado como
// "Concluido" (mesma inferencia por data das outras telas do Admin).
//
// Se dois agendamentos se sobrepoem (capacidade maior que 1), eles dividem a
// largura lado a lado, para nenhum ficar escondido atras do outro.
//
// Componente de servidor: so desenha o que page.tsx calculou.

export type EventoAgenda = {
  id: string;
  /** minutos desde a meia-noite, no fuso da estetica */
  inicioMin: number;
  fimMin: number;
  cliente: string;
  detalhe: string;
  status: StatusAgendamento;
};

const PX_HORA = 56;

const ESTILO: Record<string, { rotulo: string; caixa: string; selo: string }> = {
  CONFIRMADO: {
    rotulo: "Confirmado",
    caixa: "border-emerald-400 bg-emerald-400/10",
    selo: "bg-emerald-400/15 text-emerald-300",
  },
  PIX_PENDENTE: {
    rotulo: "PIX pendente",
    caixa: "border-amber-400 bg-amber-400/10",
    selo: "bg-amber-400/15 text-amber-300",
  },
  PENDENTE_PAGAMENTO: {
    rotulo: "No local",
    caixa: "border-sky-300 bg-sky-400/10",
    selo: "bg-sky-400/15 text-sky-300",
  },
  FEITO: {
    rotulo: "Concluído",
    caixa: "border-emerald-400 bg-emerald-400/10",
    selo: "bg-emerald-400/15 text-emerald-300",
  },
};

// Mesma regra da tela de Agendamentos: a cor da caixa segue o horario
// (concluido em verde, em andamento na cor da situacao com a luz na borda,
// o que ainda vai acontecer na cor da estetica). O selo diz a situacao.
const FUTURO = "border-astro-blue-bright bg-[color-mix(in_srgb,var(--color-astro-blue)_16%,transparent)]";

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// Distribui os eventos em "faixas" lado a lado. Um grupo e uma sequencia de
// eventos que se encostam; dentro dele cada evento pega a primeira faixa livre,
// e a largura de todos e dividida pelo numero de faixas do grupo.
function emFaixas(eventos: EventoAgenda[]) {
  const ordenados = [...eventos].sort((a, b) => a.inicioMin - b.inicioMin);
  const saida: { ev: EventoAgenda; faixa: number; total: number }[] = [];
  let grupo: { ev: EventoAgenda; faixa: number }[] = [];
  let fimGrupo = -1;
  const fecharGrupo = () => {
    const total = Math.max(1, ...grupo.map((g) => g.faixa + 1));
    grupo.forEach((g) => saida.push({ ...g, total }));
    grupo = [];
  };
  for (const ev of ordenados) {
    if (ev.inicioMin >= fimGrupo && grupo.length) fecharGrupo();
    const ocupadas = grupo.filter((g) => g.ev.fimMin > ev.inicioMin).map((g) => g.faixa);
    let faixa = 0;
    while (ocupadas.includes(faixa)) faixa++;
    grupo.push({ ev, faixa });
    fimGrupo = Math.max(fimGrupo, ev.fimMin);
  }
  if (grupo.length) fecharGrupo();
  return saida;
}

export function AgendaHoje({
  eventos,
  abreMin,
  fechaMin,
  agoraMin,
  expediente,
}: {
  eventos: EventoAgenda[];
  /** null = a estetica nao abre hoje */
  abreMin: number | null;
  fechaMin: number | null;
  agoraMin: number;
  expediente: string;
}) {
  if (abreMin === null || fechaMin === null) {
    if (eventos.length === 0) {
      return (
        <Moldura expediente={expediente}>
          <p className="rounded-xl border border-dashed border-admin-border p-8 text-center text-sm text-astro-muted">
            A estética está fechada hoje pela grade de horários.
          </p>
        </Moldura>
      );
    }
  }

  // A escala vai da primeira a ultima hora cheia que cobre o expediente e
  // qualquer agendamento fora dele.
  const inicio = Math.floor(Math.min(abreMin ?? 24 * 60, ...eventos.map((e) => e.inicioMin)) / 60) * 60;
  const fim = Math.ceil(Math.max(fechaMin ?? 0, ...eventos.map((e) => e.fimMin)) / 60) * 60;
  const horas: number[] = [];
  for (let m = inicio; m <= fim; m += 60) horas.push(m);
  const y = (min: number) => ((min - inicio) / 60) * PX_HORA;

  return (
    <Moldura expediente={expediente}>
      <div className="relative grid grid-cols-[2.75rem_minmax(0,1fr)]" style={{ height: y(fim) + 8 }}>
        <div className="relative">
          {horas.map((m) => (
            <span
              key={m}
              className="absolute left-0 -translate-y-1.5 font-mono text-[0.7rem] text-astro-muted"
              style={{ top: y(m) }}
            >
              {hhmm(m)}
            </span>
          ))}
        </div>

        <div className="relative border-l border-dashed border-admin-border">
          {horas.map((m) => (
            <div key={m} className="absolute inset-x-0 border-t border-white/5" style={{ top: y(m) }} />
          ))}

          {emFaixas(eventos).map(({ ev, faixa, total }) => {
            const passou = ev.fimMin <= agoraMin;
            const andando = !passou && ev.inicioMin <= agoraMin;
            const estilo = ESTILO[passou ? "FEITO" : ev.status] ?? ESTILO.CONFIRMADO;
            const caixa = passou ? estilo.caixa : andando ? `borda-viva ${estilo.caixa}` : FUTURO;
            const altura = Math.max(y(ev.fimMin) - y(ev.inicioMin) - 4, 30);
            const curto = altura < 46;
            return (
              <div
                key={ev.id}
                className={`absolute overflow-hidden rounded-xl border-l-[3px] px-2.5 ${curto ? "flex items-center" : "py-1.5"} ${caixa}`}
                style={{
                  top: y(ev.inicioMin) + 2,
                  height: altura,
                  left: `calc(${(faixa / total) * 100}% + 8px)`,
                  width: `calc(${100 / total}% - 12px)`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate pr-20 text-[0.8rem] font-semibold text-white">
                    {hhmm(ev.inicioMin)} · {ev.cliente}
                  </p>
                  {!curto && <p className="truncate text-[0.7rem] text-astro-muted">{ev.detalhe}</p>}
                </div>
                {total === 1 && (
                  <span
                    className={`absolute top-1.5 right-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${estilo.selo}`}
                  >
                    {andando ? "Em andamento" : estilo.rotulo}
                  </span>
                )}
              </div>
            );
          })}

          {agoraMin >= inicio && agoraMin <= fim && (
            <div className="absolute -left-1.5 right-0 z-10 border-t-2 border-red-500" style={{ top: y(agoraMin) }}>
              <span className="absolute -top-1.5 -left-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="absolute right-0 -top-4 font-mono text-[0.65rem] font-bold text-red-400">
                agora {hhmm(agoraMin)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[0.7rem] text-astro-muted">
        <Legenda cor="bg-emerald-400" texto="Concluído" />
        <Legenda cor="bg-astro-blue-bright" texto="A seguir" />
      </div>
    </Moldura>
  );
}

function Moldura({ expediente, children }: { expediente: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-admin-border bg-admin-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Agenda de hoje</h2>
        <span className="text-xs text-astro-muted">{expediente}</span>
      </div>
      {children}
    </section>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${cor}`} />
      {texto}
    </span>
  );
}
