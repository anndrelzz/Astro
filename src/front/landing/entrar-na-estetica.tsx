"use client";

import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MIN_LETRAS_BUSCA, semAcento } from "@/compartilhado/busca-estetica";

// Botao "Entrar" / "Ja tenho cadastro" da landing. No Astro nao existe um
// login unico: cada estetica tem o seu (/<slug>/login). Entao o botao abre um
// pop-up em que o dono digita parte do nome da estetica e escolhe a dele.
//
// A busca espera a pessoa parar de digitar (ESPERA_MS) e cancela a anterior,
// para nao disparar uma chamada por letra nem mostrar um resultado velho.
// Esc ou clique fora fecham, e o foco volta para o botao que abriu.
//
// O pop-up vai direto para o <body> (portal): o botao do menu fica dentro de
// um elemento com backdrop-filter, e o da abertura dentro de uma animacao com
// transform. Os dois prenderiam um "position: fixed" dentro deles.

const ESPERA_MS = 300;

type Estetica = { nome: string; slug: string; logoUrl: string | null };
// Resposta da ultima busca, com o texto a que ela responde: enquanto o texto
// do campo for outro, a tela mostra "Buscando..." em vez de um resultado velho.
type Resposta = { para: string } & ({ tipo: "pronto"; esteticas: Estetica[] } | { tipo: "erro" });

export function EntrarNaEstetica({ children, className }: { children: ReactNode; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }

  return (
    <>
      <button ref={botao} type="button" onClick={() => setAberto(true)} className={className}>
        {children}
      </button>
      {aberto && createPortal(<PopUp aoFechar={fechar} />, document.body)}
    </>
  );
}

function PopUp({ aoFechar }: { aoFechar: () => void }) {
  const idTitulo = useId();
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const termo = texto.trim();
  const curto = semAcento(termo).length < MIN_LETRAS_BUSCA;
  const atual = resposta?.para === termo ? resposta : null;
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    if (curto) return;
    const cancelar = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/esteticas/busca?q=${encodeURIComponent(termo)}`, { signal: cancelar.signal });
        if (!r.ok) throw new Error(String(r.status));
        const { esteticas } = (await r.json()) as { esteticas: Estetica[] };
        setResposta({ para: termo, tipo: "pronto", esteticas });
      } catch {
        if (!cancelar.signal.aborted) setResposta({ para: termo, tipo: "erro" });
      }
    }, ESPERA_MS);
    return () => {
      clearTimeout(id);
      cancelar.abort();
    };
  }, [termo, curto]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-start justify-center overflow-y-auto bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onKeyDown={(e) => {
          if (e.key === "Escape") aoFechar();
        }}
        className="vidro grid w-full max-w-md gap-4 rounded-3xl p-5 text-landing-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 id={idTitulo} className="text-xl font-extrabold">
              Entrar na sua estética
            </h2>
            <p className="text-sm text-zinc-300">Digite o nome da estética para ir ao login dela.</p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-landing-line-strong transition-colors hover:border-landing-glow"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-landing-line-strong bg-black/40 px-4 focus-within:border-landing-glow">
          <Search aria-hidden className="size-4 shrink-0 text-landing-muted" />
          <span className="sr-only">Nome da estética</span>
          <input
            ref={campo}
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: EstimaCar"
            autoComplete="off"
            className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-landing-muted"
          />
        </label>

        <div aria-live="polite" className="min-h-12">
          {curto && (
            <p className="text-sm text-zinc-400">Digite pelo menos {MIN_LETRAS_BUSCA} letras do nome.</p>
          )}
          {!curto && !atual && <p className="text-sm text-zinc-400">Buscando...</p>}
          {!curto && atual?.tipo === "erro" && (
            <p className="text-sm text-red-300">Não deu para buscar agora. Tente de novo em instantes.</p>
          )}
          {!curto && atual?.tipo === "pronto" && atual.esteticas.length === 0 && (
            <p className="text-sm text-zinc-300">Nenhuma estética encontrada com esse nome.</p>
          )}
          {!curto && atual?.tipo === "pronto" && atual.esteticas.length > 0 && (
            <ul className="grid gap-2">
              {atual.esteticas.map((e) => (
                <li key={e.slug}>
                  <a
                    href={`/${e.slug}/login`}
                    className="group flex items-center gap-3 rounded-2xl border border-landing-line bg-white/[0.04] p-3 transition-colors hover:border-landing-glow"
                  >
                    {e.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- logo enviado pela estetica, servido pela API
                      <img src={e.logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-landing-blue text-sm font-bold">
                        {e.nome.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-bold">{e.nome}</span>
                      <span className="truncate font-mono text-xs text-landing-muted">useastro.app.br/{e.slug}</span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-landing-glow transition-transform group-hover:translate-x-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
