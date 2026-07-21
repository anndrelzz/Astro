"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Clock } from "lucide-react";
import type { SegmentoVeiculo } from "@/generated/prisma/enums";

type Servico = {
  id: string;
  nome: string;
  duracaoMin: number;
  precos: Record<SegmentoVeiculo, number>;
};

const SEGMENTOS: { valor: SegmentoVeiculo; label: string }[] = [
  { valor: "HATCH", label: "Hatch" },
  { valor: "SEDAN", label: "Sedan" },
  { valor: "SUV", label: "SUV" },
  { valor: "PICKUP", label: "Pickup" },
  { valor: "VAN", label: "Van" },
];

function formatarPreco(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// Tela 06 — seletor de segmento (preview de precos, RF04) + cards de servico.
export function HomeServicos({
  slug,
  servicos,
  segmentoInicial,
  logado,
}: {
  slug: string;
  servicos: Servico[];
  segmentoInicial: SegmentoVeiculo;
  logado: boolean;
}) {
  const [segmento, setSegmento] = useState<SegmentoVeiculo>(segmentoInicial);

  return (
    <div className="mt-6">
      <p className="text-sm text-zinc-500">
        Selecione o segmento do seu veículo para ver os preços.
      </p>

      {/* Seletor de segmento */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SEGMENTOS.map((s) => {
          const ativo = s.valor === segmento;
          return (
            <button
              key={s.valor}
              onClick={() => setSegmento(s.valor)}
              className={
                ativo
                  ? "flex shrink-0 items-center gap-2 rounded-full bg-astro-bg px-5 py-2.5 text-sm font-semibold text-white"
                  : "flex shrink-0 items-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm text-zinc-600"
              }
            >
              {ativo && <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Cabecalho da secao */}
      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="astro-label">
            {String(servicos.length).padStart(2, "0")} disponíveis
          </p>
          <h2 className="text-xl font-bold text-zinc-900">Nossos Serviços</h2>
        </div>
      </div>

      {/* Cards de servico */}
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {servicos.map((servico) => (
          <div
            key={servico.id}
            className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm"
          >
            {/* Imagem placeholder com badge de duracao */}
            <div className="relative flex h-36 items-end bg-gradient-to-br from-astro-surface-2 to-astro-bg p-3">
              <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <Clock className="h-3 w-3" />
                {formatarDuracao(servico.duracaoMin)}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-semibold text-zinc-900">{servico.nome}</h3>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-wide text-zinc-400">
                    {segmento}
                  </p>
                  <p className="text-lg font-bold text-zinc-900">
                    {formatarPreco(servico.precos[segmento])}
                  </p>
                </div>
                <Link
                  href={
                    logado
                      ? `/${slug}/agendar/${servico.id}`
                      : `/${slug}/login?callbackUrl=/${slug}/agendar/${servico.id}`
                  }
                  aria-label={`Agendar ${servico.nome}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-astro-blue text-white shadow-lg shadow-astro-blue/30"
                >
                  <Plus className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {servicos.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
