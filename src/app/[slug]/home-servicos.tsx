"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Car, ChevronRight, Clock, Sparkles } from "lucide-react";

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracaoMin: number;
  /// segmentoId -> preco. Chave e id, nao nome: a estetica pode renomear o
  /// segmento sem que os precos se percam.
  precos: Record<string, number>;
};

export type SegmentoView = { id: string; nome: string };

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// Tela 06 — seletor de segmento (preview de precos, RF04) + lista de servicos.
//
// No celular e uma lista vertical, e nao um carrossel: no carrossel o cliente
// via um servico e meio e nao sabia que havia outros. O card inteiro e o
// botao de agendar, com o preco do tipo escolhido sempre a vista.
export function HomeServicos({
  slug,
  servicos,
  segmentos,
  segmentoInicial,
  logado,
  temVeiculo,
}: {
  slug: string;
  servicos: Servico[];
  segmentos: SegmentoView[];
  segmentoInicial: string;
  logado: boolean;
  temVeiculo: boolean;
}) {
  const [segmento, setSegmento] = useState(segmentoInicial);
  // RN04 — logado sem veiculo cai no aviso "sem veiculo" (tela 07) ao agendar.
  const [semVeiculo, setSemVeiculo] = useState(false);

  // Destino do agendamento conforme estado do usuario.
  function hrefAgendar(servicoId: string) {
    return logado
      ? `/${slug}/agendar/${servicoId}`
      : `/${slug}/login?callbackUrl=/${slug}/agendar/${servicoId}`;
  }

  return (
    <section aria-labelledby="titulo-servicos" className="mt-2 lg:mt-3">
      <h2 id="titulo-servicos" className="text-xl font-bold text-white lg:text-2xl">
        Serviços
      </h2>

      {/* Seletor de segmento. Os tipos vem da estetica (RN01 revisada), entao a
          quantidade varia: uma pode ter tres, outra sete. No celular rola na
          horizontal; no desktop os chips quebram em linhas. Ja abre no tipo do
          carro do cliente. */}
      <p id="rotulo-segmento" className="mt-1 text-sm text-astro-muted">
        Preços para o tipo do seu carro
      </p>
      <div
        role="radiogroup"
        aria-labelledby="rotulo-segmento"
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {segmentos.map((s) => {
          const ativo = s.id === segmento;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setSegmento(s.id)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                ativo
                  ? "bg-white text-black"
                  : "border border-white/15 text-slate-300 hover:border-white/30 hover:text-white"
              }`}
            >
              {s.nome}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-3 lg:grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] lg:gap-4">
        {servicos.map((servico) => {
          const preco = servico.precos[segmento];
          const conteudo = (
            <>
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-astro-blue-bright), color-mix(in srgb, var(--color-astro-blue) 60%, black))",
                }}
              >
                <Sparkles className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-white">{servico.nome}</span>
                {servico.descricao && (
                  <span className="mt-0.5 line-clamp-1 text-sm text-astro-muted">
                    {servico.descricao}
                  </span>
                )}
                <span className="mt-2 flex items-center gap-3 text-sm">
                  {/* Preco ausente so acontece na janela entre o Admin criar
                      um tipo novo e precificar os servicos. Melhor dizer que
                      falta combinar do que exibir R$ 0,00 como se fosse gratis. */}
                  {preco === undefined ? (
                    <span className="text-astro-muted">Sob consulta</span>
                  ) : (
                    <span className="font-bold text-white tabular-nums">{formatarPreco(preco)}</span>
                  )}
                  <span className="flex items-center gap-1 text-astro-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {formatarDuracao(servico.duracaoMin)}
                  </span>
                </span>
              </span>

              <ChevronRight className="h-5 w-5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
            </>
          );
          const classe =
            "vidro group flex w-full items-center gap-3.5 rounded-2xl p-4 text-left transition hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-astro-blue-bright";

          return (
            <li key={servico.id}>
              {logado && !temVeiculo ? (
                <button
                  type="button"
                  onClick={() => setSemVeiculo(true)}
                  aria-label={`Agendar ${servico.nome}`}
                  className={classe}
                >
                  {conteudo}
                </button>
              ) : (
                <Link href={hrefAgendar(servico.id)} aria-label={`Agendar ${servico.nome}`} className={classe}>
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {servicos.length === 0 && (
        <p className="mt-4 text-sm text-astro-muted">Nenhum serviço cadastrado ainda.</p>
      )}

      {/* Tela 07 — aviso "sem veiculo" (RN04). No celular sobe de baixo, perto
          do polegar; no computador fica no centro. */}
      {semVeiculo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <button
            aria-label="Fechar"
            onClick={() => setSemVeiculo(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-sem-veiculo"
            className="relative w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#0d0d11] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center shadow-2xl sm:rounded-3xl sm:pb-6"
          >
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{
                background: "linear-gradient(135deg, var(--color-astro-blue), var(--color-astro-blue-bright))",
                boxShadow: "0 0 0 8px color-mix(in srgb, var(--color-astro-blue) 18%, transparent)",
              }}
            >
              <Car className="h-6 w-6" />
            </span>
            <h2 id="titulo-sem-veiculo" className="mt-5 text-lg font-bold text-white">
              Cadastre seu veículo primeiro
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-astro-muted">
              O preço e o horário dependem do tipo do carro. Leva menos de um minuto.
            </p>

            {/* Fecha este aviso ao entregar a vez para o cadastro. Como o
                cadastro e rota interceptada, ele abre como pop-up SEM desmontar
                esta pagina — e sem fechar aqui, os dois ficariam empilhados,
                cada um com seu proprio fundo escurecido. Um de cada vez. */}
            <Link
              onClick={() => setSemVeiculo(false)}
              href={`/${slug}/veiculos/novo?callbackUrl=/${slug}`}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_var(--color-astro-blue)] transition hover:brightness-110"
            >
              Cadastrar veículo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setSemVeiculo(false)}
              className="mt-2 w-full rounded-full py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Agora não
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
