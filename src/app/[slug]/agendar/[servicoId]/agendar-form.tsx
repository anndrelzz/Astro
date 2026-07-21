"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
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

// Tela 09 — data/horario/veiculo. Ao confirmar, segue para pagamento (tela 10).
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
    <div className="min-h-screen bg-white">
      <ThemeColor color="#0b1120" />
      {/* Cabecalho escuro */}
      <div className="astro-dark px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
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

      {/* Sheet claro */}
      <div className="mx-auto -mt-10 max-w-md rounded-t-3xl bg-white px-5 pb-32 pt-6">
        {/* Cabecalho do servico */}
        <div className="flex items-start justify-between">
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
              R$ {veiculo.preco.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>

        {/* Calendario */}
        <div className="mt-6 flex items-center justify-between">
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

        {/* Horarios */}
        <p className="mt-6 astro-label">Horários disponíveis</p>
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

        {/* Veiculo */}
        <div className="mt-6 flex items-center justify-between">
          <p className="astro-label">Veículo</p>
          {veiculos.length > 1 && (
            <button
              onClick={() => setTrocando((v) => !v)}
              className="text-sm font-semibold text-astro-blue"
            >
              Trocar
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {(trocando ? veiculos : [veiculo]).map((v) => {
            const sel = v.id === veiculoId;
            return (
              <button
                key={v.id}
                onClick={() => {
                  setVeiculoId(v.id);
                  setTrocando(false);
                }}
                className={
                  sel
                    ? "flex w-full items-center justify-between rounded-xl border-2 border-astro-blue bg-astro-blue/5 p-3 text-left"
                    : "flex w-full items-center justify-between rounded-xl border border-zinc-200 p-3 text-left"
                }
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-astro-bg text-[0.6rem] font-semibold text-white">
                    {v.segmento}
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {v.marca} {v.modelo}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {v.placa} · {v.segmento} · {v.ano}
                    </p>
                  </div>
                </div>
                {sel && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-astro-blue text-white">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Botao fixo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-100 bg-white/95 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
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
