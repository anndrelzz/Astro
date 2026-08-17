"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Clock, Car, ArrowRight } from "lucide-react";
import type { SegmentoVeiculo } from "@/generated/prisma/enums";

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
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
  temVeiculo,
}: {
  slug: string;
  servicos: Servico[];
  segmentoInicial: SegmentoVeiculo;
  logado: boolean;
  temVeiculo: boolean;
}) {
  const [segmento, setSegmento] = useState<SegmentoVeiculo>(segmentoInicial);
  // RN04 — logado sem veiculo cai no modal "sem veiculo" (tela 07) ao agendar.
  const [semVeiculo, setSemVeiculo] = useState(false);

  // Destino do agendamento conforme estado do usuario.
  function hrefAgendar(servicoId: string) {
    return logado
      ? `/${slug}/agendar/${servicoId}`
      : `/${slug}/login?callbackUrl=/${slug}/agendar/${servicoId}`;
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-zinc-500">
        Selecione o segmento do seu veículo para ver os preços.
      </p>

      {/* Seletor de segmento. No celular rola na horizontal (os 5 segmentos
          nao cabem em 448px); no desktop ha espaco de sobra, entao a rolagem
          sai e os chips ficam todos visiveis. */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible">
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

      {/* Cards de servico. No celular e um carrossel horizontal de cards de
          224px; no desktop vira grade (tela 06 do mockup), que mostra o
          catalogo inteiro sem rolar. As colunas acompanham a largura da tela
          para nao esticar o card quando a estetica tem poucos servicos. */}
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] lg:gap-5 lg:overflow-visible">
        {servicos.map((servico) => (
          <div
            key={servico.id}
            className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition lg:w-auto lg:shrink lg:hover:-translate-y-0.5 lg:hover:shadow-md"
          >
            {/* Imagem placeholder com badge de duracao */}
            <div className="relative flex h-36 items-end bg-gradient-to-br from-astro-surface-2 to-astro-bg p-3 lg:h-44">
              <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <Clock className="h-3 w-3" />
                {formatarDuracao(servico.duracaoMin)}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-semibold text-zinc-900">{servico.nome}</h3>
              {servico.descricao && (
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                  {servico.descricao}
                </p>
              )}
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-wide text-zinc-400">
                    {segmento}
                  </p>
                  <p className="text-lg font-bold text-zinc-900">
                    {formatarPreco(servico.precos[segmento])}
                  </p>
                </div>
                {logado && !temVeiculo ? (
                  <button
                    onClick={() => setSemVeiculo(true)}
                    aria-label={`Agendar ${servico.nome}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-astro-blue text-white shadow-lg shadow-astro-blue/30"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                ) : (
                  <Link
                    href={hrefAgendar(servico.id)}
                    aria-label={`Agendar ${servico.nome}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-astro-blue text-white shadow-lg shadow-astro-blue/30"
                  >
                    <Plus className="h-5 w-5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}

        {servicos.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum serviço cadastrado ainda.</p>
        )}
      </div>

      {/* Tela 07 — modal "sem veiculo" (RN04) */}
      {semVeiculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            aria-label="Fechar"
            onClick={() => setSemVeiculo(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-astro-blue/10">
              <Car className="h-6 w-6 text-astro-blue" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-astro-blue text-[0.7rem] font-bold text-white">
                !
              </span>
            </div>
            <h2 className="mt-4 text-lg font-bold text-zinc-900">
              Veículo não cadastrado
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Você ainda não possui um veículo cadastrado. Só conseguirá
              prosseguir para o agendamento se realizar o cadastro.
            </p>

            {/* Fecha este alerta ao entregar a vez para o cadastro. Como o
                cadastro e rota interceptada, ele abre como pop-up SEM desmontar
                esta pagina — e sem fechar aqui, os dois modais ficariam
                empilhados, cada um com seu proprio fundo escurecido. Um modal
                de cada vez. */}
            <Link
              onClick={() => setSemVeiculo(false)}
              href={`/${slug}/veiculos/novo?callbackUrl=/${slug}`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-astro-blue to-astro-blue-bright py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25"
            >
              Cadastrar veículo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setSemVeiculo(false)}
              className="mt-2 w-full py-2 text-sm font-semibold text-astro-blue"
            >
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
