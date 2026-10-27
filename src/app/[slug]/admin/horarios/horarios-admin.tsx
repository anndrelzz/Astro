"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Clock, Copy } from "lucide-react";

// UC09, RF02 — grade semanal de funcionamento. Um dia desligado significa
// estetica fechada: a rota PUT /api/tenant/horarios remove o registro daquele
// dia.
//
// Cada dia mostra, alem dos campos, uma barra com o trecho aberto dentro do
// dia: empilhadas, as sete barras deixam ver a semana de relance (sabado meio
// periodo, domingo fechado) sem ler hora por hora.

type HorarioDia = {
  diaSemana: number;
  nome: string;
  ativo: boolean;
  horaInicio: string;
  horaFim: string;
};

// Para onde copiar o horario de um dia. Dias uteis = segunda a sexta.
const DESTINOS = [
  { chave: "uteis", rotulo: "Segunda a sexta" },
  { chave: "abertos", rotulo: "Todos os dias abertos" },
  { chave: "todos", rotulo: "Todos os dias" },
] as const;
type Destino = (typeof DESTINOS)[number]["chave"];

function paraMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function formatarDuracao(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const invalido = (dia: HorarioDia) => dia.ativo && dia.horaInicio >= dia.horaFim;

export function HorariosAdmin({ horariosIniciais }: { horariosIniciais: HorarioDia[] }) {
  const router = useRouter();
  const [horarios, setHorarios] = useState(horariosIniciais);
  const [salvos, setSalvos] = useState(horariosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [copiandoDe, setCopiandoDe] = useState<number | null>(null);

  const alterado = JSON.stringify(horarios) !== JSON.stringify(salvos);
  const temErro = horarios.some(invalido);

  // Fechar ou recarregar a aba com alteracao pendente pede confirmacao.
  useEffect(() => {
    if (!alterado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  function atualizarDia(diaSemana: number, campo: keyof HorarioDia, valor: string | boolean) {
    setHorarios((atual) => atual.map((h) => (h.diaSemana === diaSemana ? { ...h, [campo]: valor } : h)));
  }

  function copiar(origem: HorarioDia, destino: Destino) {
    setHorarios((atual) =>
      atual.map((h) => {
        if (h.diaSemana === origem.diaSemana) return h;
        const util = h.diaSemana >= 1 && h.diaSemana <= 5;
        if (destino === "uteis" && !util) return h;
        if (destino === "abertos" && !h.ativo) return h;
        return { ...h, ativo: true, horaInicio: origem.horaInicio, horaFim: origem.horaFim };
      })
    );
    setCopiandoDe(null);
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);

    const resposta = await fetch("/api/tenant/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        horarios.map(({ diaSemana, ativo, horaInicio, horaFim }) => ({ diaSemana, ativo, horaInicio, horaFim }))
      ),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível salvar a grade.");
      return;
    }
    setSalvos(horarios);
    router.refresh();
  }

  const abertos = horarios.filter((h) => h.ativo && !invalido(h));
  const minutosSemana = abertos.reduce((soma, h) => soma + paraMinutos(h.horaFim) - paraMinutos(h.horaInicio), 0);

  // Escala das barras: das 6h as 22h, alargada se algum dia passar disso.
  const escalaInicio = Math.min(6 * 60, ...abertos.map((h) => Math.floor(paraMinutos(h.horaInicio) / 60) * 60));
  const escalaFim = Math.max(22 * 60, ...abertos.map((h) => Math.ceil(paraMinutos(h.horaFim) / 60) * 60));
  const pct = (min: number) => ((min - escalaInicio) / (escalaFim - escalaInicio)) * 100;
  const marcas = Array.from({ length: Math.floor((escalaFim - escalaInicio) / 180) + 1 }, (_, i) => escalaInicio + i * 180);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Grade de horários</h1>
          <p className="mt-1.5 text-astro-muted">
            {abertos.length === 0
              ? "Nenhum dia aberto. O cliente não consegue agendar."
              : `Aberto ${abertos.length} ${abertos.length === 1 ? "dia" : "dias"} · ${formatarDuracao(minutosSemana)} por semana`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {alterado && <span className="text-sm text-amber-300">Alterações não salvas</span>}
          <button
            type="button"
            onClick={salvar}
            disabled={!alterado || salvando || temErro}
            className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
              alterado && !temErro
                ? "bg-astro-blue text-white shadow-[0_14px_30px_-14px_var(--color-astro-blue)] hover:brightness-110"
                : "border border-admin-border text-astro-muted"
            } disabled:cursor-not-allowed`}
          >
            <Check className="h-4 w-4" />
            {salvando ? "Salvando..." : alterado ? "Salvar grade" : "Grade salva"}
          </button>
        </div>
      </div>

      {erro && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{erro}</p>
      )}

      <section className="rounded-3xl border border-admin-border bg-admin-surface p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Quando sua estética atende</h2>
          <span className="text-sm text-astro-muted">O cliente só vê horários dentro dessas faixas.</span>
        </div>

        {/* Marcas de hora acima das barras (so no computador, onde as barras
            ficam alinhadas numa coluna) */}
        <div className="hidden grid-cols-[11rem_19rem_minmax(0,1fr)_2.75rem] gap-4 px-4 xl:grid">
          <span />
          <span />
          <div className="relative h-5">
            {marcas.map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2 font-mono text-[0.65rem] text-astro-muted"
                style={{ left: `${pct(m)}%` }}
              >
                {m / 60}h
              </span>
            ))}
          </div>
          <span />
        </div>

        <ul className="grid gap-2">
          {horarios.map((dia) => {
            const errado = invalido(dia);
            const inicio = paraMinutos(dia.horaInicio);
            const fim = paraMinutos(dia.horaFim);
            return (
              <li
                key={dia.diaSemana}
                className={`grid items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 transition sm:grid-cols-[11rem_19rem_minmax(0,1fr)] xl:grid-cols-[11rem_19rem_minmax(0,1fr)_2.75rem] ${
                  errado
                    ? "border-red-500/50 bg-red-500/5"
                    : dia.ativo
                      ? "border-admin-border bg-admin-surface-2"
                      : "border-admin-border/60"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      checked={dia.ativo}
                      onChange={(e) => atualizarDia(dia.diaSemana, "ativo", e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-zinc-700 transition peer-checked:bg-astro-blue peer-focus-visible:ring-2 peer-focus-visible:ring-astro-blue-bright" />
                    <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </span>
                  <span className={`text-sm font-semibold ${dia.ativo ? "text-white" : "text-astro-muted"}`}>{dia.nome}</span>
                </label>

                <div className="flex items-center gap-2">
                  <CampoHora
                    rotulo={`${dia.nome}, abre`}
                    valor={dia.horaInicio}
                    ativo={dia.ativo}
                    onChange={(v) => atualizarDia(dia.diaSemana, "horaInicio", v)}
                  />
                  <span className="text-xs text-astro-muted">às</span>
                  <CampoHora
                    rotulo={`${dia.nome}, fecha`}
                    valor={dia.horaFim}
                    ativo={dia.ativo}
                    onChange={(v) => atualizarDia(dia.diaSemana, "horaFim", v)}
                  />
                </div>

                {/* Barra do dia, com a duracao ao lado */}
                <div className="flex min-w-0 items-center gap-3 sm:col-span-full xl:col-span-1">
                  {errado ? (
                    <p className="text-sm text-red-300">O horário de fechar precisa ser depois do de abrir.</p>
                  ) : (
                    <>
                      <div className="relative h-2.5 min-w-0 flex-1 rounded-full bg-white/[0.06]">
                        {dia.ativo && (
                          <span
                            className="absolute inset-y-0 rounded-full bg-astro-blue shadow-[0_0_14px_-2px_var(--color-astro-blue)]"
                            style={{ left: `${pct(inicio)}%`, width: `${pct(fim) - pct(inicio)}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`w-14 shrink-0 text-right font-mono text-xs ${dia.ativo ? "text-slate-200" : "text-astro-muted"}`}
                      >
                        {dia.ativo ? formatarDuracao(fim - inicio) : "fechado"}
                      </span>
                    </>
                  )}
                </div>

                {/* Copiar este horario para outros dias */}
                <div className="relative hidden justify-end xl:flex">
                  {dia.ativo && !errado && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCopiandoDe(copiandoDe === dia.diaSemana ? null : dia.diaSemana)}
                        aria-label={`Copiar o horário de ${dia.nome} para outros dias`}
                        aria-expanded={copiandoDe === dia.diaSemana}
                        title="Copiar para outros dias"
                        className="grid h-9 w-9 place-items-center rounded-full border border-admin-border text-astro-muted transition hover:border-astro-blue hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {copiandoDe === dia.diaSemana && (
                        <MenuCopiar nome={dia.nome} onEscolher={(d) => copiar(dia, d)} onFechar={() => setCopiandoDe(null)} />
                      )}
                    </>
                  )}
                </div>

                {/* No celular e tablet o botao de copiar vira um link de texto */}
                {dia.ativo && !errado && (
                  <div className="relative xl:hidden">
                    <button
                      type="button"
                      onClick={() => setCopiandoDe(copiandoDe === dia.diaSemana ? null : dia.diaSemana)}
                      aria-expanded={copiandoDe === dia.diaSemana}
                      className="flex items-center gap-1.5 text-xs font-semibold text-astro-blue-bright"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar para outros dias
                    </button>
                    {copiandoDe === dia.diaSemana && (
                      <MenuCopiar nome={dia.nome} onEscolher={(d) => copiar(dia, d)} onFechar={() => setCopiandoDe(null)} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function MenuCopiar({
  nome,
  onEscolher,
  onFechar,
}: {
  nome: string;
  onEscolher: (destino: Destino) => void;
  onFechar: () => void;
}) {
  // Esc fecha o menu.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <>
      {/* Camada invisivel: clicar fora fecha o menu */}
      <button type="button" aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 z-30 cursor-default" />
      <div
        role="menu"
        className="absolute top-full left-0 z-40 mt-2 w-60 rounded-2xl border border-admin-border bg-admin-surface-2 p-1.5 shadow-2xl shadow-black/60 xl:right-0 xl:left-auto"
      >
        <p className="px-3 pt-1.5 pb-1 text-xs text-astro-muted">Usar o horário de {nome.toLowerCase()} em:</p>
        {DESTINOS.map((d) => (
          <button
            key={d.chave}
            type="button"
            role="menuitem"
            onClick={() => onEscolher(d.chave)}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
          >
            {d.rotulo}
          </button>
        ))}
      </div>
    </>
  );
}

// Campo de hora com o icone de relogio dentro. Dia desligado deixa o campo
// esmaecido e travado.
function CampoHora({
  rotulo,
  valor,
  ativo,
  onChange,
}: {
  rotulo: string;
  valor: string;
  ativo: boolean;
  onChange: (valor: string) => void;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-admin-border bg-admin-bg px-3 py-2 focus-within:border-astro-blue sm:flex-none ${ativo ? "" : "opacity-40"}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
      <input
        type="time"
        aria-label={rotulo}
        value={valor}
        disabled={!ativo}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-[4.5rem] bg-transparent sm:min-w-[5.5rem] font-mono text-sm text-slate-100 outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
