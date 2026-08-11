"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { ThemeColor } from "@/components/ui/theme-color";

type Veiculo = {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  ano: number;
  segmento: string;
  preco: number;
};

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const DIAS_EXTENSO = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function isoLocal(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min}MIN`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}H ${m}MIN` : `${h}H`;
}

// "10:00" + 150min -> "12:30". O mockup mostra a faixa completa no resumo, e
// o fim do atendimento e o que o cliente precisa para planejar o dia.
function somarMinutos(hora: string, minutos: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function precoFormatado(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

type ListaVeiculosProps = {
  veiculos: Veiculo[];
  veiculoId: string;
  aoEscolher: (id: string) => void;
  escuro?: boolean;
};

// A lista de veiculos aparece em dois lugares: no corpo da tela no celular e
// dentro do cartao de resumo no desktop (tela 09 do mockup). Mesma lista, dois
// fundos — por isso a variante escura, em vez de duas copias do markup.
function ListaVeiculos({ veiculos, veiculoId, aoEscolher, escuro }: ListaVeiculosProps) {
  return (
    <div className="space-y-2">
      {veiculos.map((v) => {
        const sel = v.id === veiculoId;
        const base = "flex w-full items-center justify-between rounded-xl p-3 text-left";
        const borda = escuro
          ? sel
            ? "border border-astro-blue bg-astro-blue/15"
            : "border border-white/10 bg-white/5"
          : sel
            ? "border-2 border-astro-blue bg-astro-blue/5"
            : "border border-zinc-200";

        return (
          <button
            key={v.id}
            type="button"
            onClick={() => aoEscolher(v.id)}
            className={`${base} ${borda}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-astro-bg text-[0.6rem] font-semibold text-white">
                {v.segmento}
              </span>
              <div className="min-w-0">
                <p className={escuro ? "font-semibold text-white" : "font-semibold text-zinc-900"}>
                  {v.marca} {v.modelo}
                </p>
                <p className={escuro ? "text-xs text-astro-muted" : "text-xs text-zinc-500"}>
                  {v.placa} · {v.segmento} · {v.ano}
                </p>
              </div>
            </div>
            {sel && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-astro-blue text-white">
                <Check className="h-4 w-4" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Tela 09 — data/horario/veiculo. Ao confirmar, segue para pagamento (tela 10).
//
// Duas formas do mesmo fluxo. No celular e uma coluna com o botao preso no
// rodape. A partir de lg vira o desenho do mockup: escolhas a esquerda e um
// cartao escuro de resumo a direita, que acompanha a rolagem e concentra o
// veiculo, o total e o botao de confirmar.
export function AgendarForm({
  slug,
  tenantId,
  servico,
  veiculos,
}: {
  slug: string;
  tenantId: string;
  servico: { id: string; nome: string; duracaoMin: number };
  veiculos: Veiculo[];
}) {
  const router = useRouter();

  // Proximos 14 dias como tira de dias selecionaveis.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    return d;
  });

  const [dataSel, setDataSel] = useState(isoLocal(hoje));
  const [slots, setSlots] = useState<string[]>([]);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [hora, setHora] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState(veiculos[0].id);
  const [trocando, setTrocando] = useState(false);

  const veiculo = veiculos.find((v) => v.id === veiculoId)!;
  const dataObj = new Date(dataSel + "T00:00:00");

  useEffect(() => {
    setHora(null);
    setCarregandoSlots(true);
    fetch(`/api/slots?tenantId=${tenantId}&servicoId=${servico.id}&data=${dataSel}`)
      .then((r) => r.json())
      .then((j) => setSlots(j.slots ?? []))
      .finally(() => setCarregandoSlots(false));
  }, [dataSel, tenantId, servico.id]);

  function confirmar() {
    if (!hora) return;
    router.push(
      `/${slug}/agendar/${servico.id}/pagamento?veiculoId=${veiculoId}&data=${dataSel}&hora=${hora}`
    );
  }

  return (
    <div className="min-h-dvh bg-white lg:min-h-0 lg:bg-transparent">
      <ThemeColor color="#0b1120" />
      {/* Cabecalho escuro — so no celular. No desktop quem situa o cliente e a
          trilha do cabecalho da casca, e o "voltar" e a propria barra lateral. */}
      <div className="astro-dark px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:hidden">
        <div className="mx-auto max-w-md">
          <Link
            href={`/${slug}`}
            aria-label="Voltar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Sheet claro no celular; grade de duas colunas no desktop. */}
      <div className="mx-auto -mt-10 max-w-md rounded-t-3xl bg-white px-5 pb-32 pt-6 lg:mx-0 lg:mt-0 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6 lg:rounded-none lg:bg-transparent lg:px-8 lg:pb-10 lg:pt-0">
        <div className="lg:space-y-4">
        {/* Cabecalho do servico. No desktop vira o cartao do topo do mockup:
            painel listrado a esquerda, dados a direita. */}
        <div className="lg:flex lg:overflow-hidden lg:rounded-2xl lg:border lg:border-zinc-100 lg:bg-white lg:shadow-sm">
          <div
            aria-hidden
            className="hidden w-52 shrink-0 bg-gradient-to-br from-astro-surface-2 to-astro-bg lg:block"
          />
          <div className="flex items-start justify-between lg:flex-1 lg:p-6">
            <div>
              <p className="flex items-center gap-2 astro-label">
                <span className="h-1.5 w-1.5 rounded-full bg-astro-blue" />
                {veiculo.segmento} · {formatarDuracao(servico.duracaoMin)}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">{servico.nome}</h1>
            </div>
            <div className="text-right">
              <p className="astro-label">Preço</p>
              <p className="text-xl font-bold text-zinc-900">
                {precoFormatado(veiculo.preco)}
              </p>
            </div>
          </div>
        </div>

        {/* Calendario */}
        <div className="lg:rounded-2xl lg:border lg:border-zinc-100 lg:bg-white lg:p-6 lg:shadow-sm">
        <div className="mt-6 flex items-center justify-between lg:mt-0">
          <p className="font-semibold text-zinc-900">
            {MESES[dataObj.getMonth()]} {dataObj.getFullYear()}
          </p>
          <div className="flex gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400">
              <ChevronLeft className="h-4 w-4" />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dias.map((d) => {
            const iso = isoLocal(d);
            const ativo = iso === dataSel;
            return (
              <button
                key={iso}
                onClick={() => setDataSel(iso)}
                className={
                  ativo
                    ? "flex shrink-0 flex-col items-center gap-1 rounded-xl bg-astro-blue px-3.5 py-2.5 text-white shadow-lg shadow-astro-blue/30"
                    : "flex shrink-0 flex-col items-center gap-1 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-zinc-700"
                }
              >
                <span className="text-[0.6rem] font-medium opacity-70">
                  {DIAS_SEMANA[d.getDay()]}
                </span>
                <span className="text-base font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        </div>

        {/* Horarios */}
        <div className="lg:rounded-2xl lg:border lg:border-zinc-100 lg:bg-white lg:p-6 lg:shadow-sm">
        <p className="mt-6 astro-label lg:mt-0">
          {DIAS_EXTENSO[dataObj.getDay()]} · {dataObj.getDate()}{" "}
          {MESES[dataObj.getMonth()].slice(0, 3)}
        </p>
        <p className="mt-1 font-semibold text-zinc-900">Horários disponíveis</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {carregandoSlots && (
            <span className="text-sm text-zinc-400">Carregando...</span>
          )}
          {!carregandoSlots && slots.length === 0 && (
            <span className="text-sm text-zinc-400">
              Nenhum horário disponível nesse dia.
            </span>
          )}
          {slots.map((s) => {
            const ativo = s === hora;
            return (
              <button
                key={s}
                onClick={() => setHora(s)}
                className={
                  ativo
                    ? "flex items-center gap-1.5 rounded-xl bg-astro-bg px-4 py-2.5 text-sm font-semibold text-white"
                    : "rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700"
                }
              >
                {ativo && <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />}
                {s}
              </button>
            );
          })}
        </div>

        </div>

        {/* Veiculo — no desktop ele mora dentro do cartao de resumo. */}
        <div className="lg:hidden">
          <div className="mt-6 flex items-center justify-between">
            <p className="astro-label">Veículo</p>
            {veiculos.length > 1 && (
              <button
                type="button"
                onClick={() => setTrocando((v) => !v)}
                className="text-sm font-semibold text-astro-blue"
              >
                Trocar
              </button>
            )}
          </div>

          <div className="mt-3">
            <ListaVeiculos
              veiculos={trocando ? veiculos : [veiculo]}
              veiculoId={veiculoId}
              aoEscolher={(id) => {
                setVeiculoId(id);
                setTrocando(false);
              }}
            />
          </div>
        </div>
        </div>

        {/* Resumo do agendamento (tela 09 do mockup). So no desktop: no celular
            o mesmo papel e feito pelo cabecalho e pelo botao preso no rodape.
            Fica grudado no topo porque a coluna da esquerda e mais alta — sem
            isso o total sairia da tela justo na hora de conferir. */}
        <aside className="astro-dark hidden rounded-2xl p-6 lg:sticky lg:top-4 lg:block">
          <p className="astro-label">Resumo do agendamento</p>
          <h2 className="mt-1 text-xl font-bold text-white">{servico.nome}</h2>

          <div className="mt-5 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="shrink-0 overflow-hidden rounded-lg bg-white text-center">
              <p className="bg-astro-blue px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-white">
                {MESES[dataObj.getMonth()].slice(0, 3)} {dataObj.getFullYear()}
              </p>
              <p className="px-2 pt-1 text-xl font-bold leading-none text-zinc-900">
                {dataObj.getDate()}
              </p>
              <p className="px-2 pb-1 font-mono text-[0.5rem] uppercase tracking-widest text-zinc-500">
                {DIAS_EXTENSO[dataObj.getDay()]}
              </p>
            </div>
            <div className="min-w-0">
              <p className="astro-label">Data e horário</p>
              <p className="mt-0.5 font-semibold text-white">
                {dataObj.getDate()} de {MESES[dataObj.getMonth()].toLowerCase()} ·{" "}
                {dataObj.getFullYear()}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-astro-muted">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {hora
                  ? `${hora} – ${somarMinutos(hora, servico.duracaoMin)}`
                  : "Escolha um horário"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="astro-label">Veículo</p>
            {veiculos.length > 1 && (
              <button
                type="button"
                onClick={() => setTrocando((v) => !v)}
                className="text-sm font-semibold text-astro-blue-bright"
              >
                {trocando ? "Fechar" : "Trocar"}
              </button>
            )}
          </div>
          <div className="mt-2">
            <ListaVeiculos
              escuro
              veiculos={trocando ? veiculos : [veiculo]}
              veiculoId={veiculoId}
              aoEscolher={(id) => {
                setVeiculoId(id);
                setTrocando(false);
              }}
            />
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
            <span className="text-astro-muted">{servico.nome}</span>
            <span className="text-white">{precoFormatado(veiculo.preco)}</span>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="astro-label">Total</span>
            <span className="text-2xl font-bold text-white">
              {precoFormatado(veiculo.preco)}
            </span>
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={!hora}
            className="mt-5 flex w-full items-center justify-between gap-2 rounded-xl bg-astro-blue px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 transition disabled:opacity-40"
          >
            Confirmar e ir ao pagamento
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </aside>
      </div>

      {/* Botao fixo — celular. No desktop o confirmar vive no resumo. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-100 bg-white/95 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-md">
          <button
            onClick={confirmar}
            disabled={!hora}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-40"
          >
            Confirmar agendamento
          </button>
        </div>
      </div>
    </div>
  );
}
