"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";

// "Conheca o Astro por dentro": abas com o print real de cada parte do painel
// do Admin (estetica de teste com dados de demonstracao, tela 1440x900), em
// public/landing/telas-admin. O caminho nao pode ter "/admin/": o proxy.ts
// trata /{slug}/admin/... como area do Admin e manda para o login. O print
// aparece grande, numa moldura de janela de navegador, para dar para ler os
// numeros.
//
// Abas acessiveis pelo teclado (padrao WAI-ARIA de tabs): setas trocam de
// aba, Home e End vao para a primeira e a ultima.

type Aba = {
  id: string;
  rotulo: string;
  texto: string;
  itens: string[];
  img: string;
  rota: string;
};

const ABAS: Aba[] = [
  {
    id: "painel",
    rotulo: "Painel do dia",
    texto: "Abriu o Astro, já vê quem chega hoje e quanto entrou.",
    itens: ["Agenda de hoje em ordem de horário", "Receita do dia e do mês", "Vagas livres no dia"],
    img: "painel",
    rota: "admin",
  },
  {
    id: "agenda",
    rotulo: "Agendamentos",
    texto: "Todos os horários marcados, separados pela situação do pagamento.",
    itens: ["Confirmados, PIX pendente, no local e concluídos", "Busca por cliente, placa ou serviço", "Confirmação do PIX com um toque"],
    img: "agendamentos",
    rota: "admin/agendamentos",
  },
  {
    id: "catalogo",
    rotulo: "Catálogo",
    texto: "Cada serviço com duração e um preço para cada tipo de veículo.",
    itens: ["Tipos de veículo definidos por você", "Pause um serviço sem apagar o histórico", "Grade de horários e capacidade por dia"],
    img: "catalogo",
    rota: "admin/catalogo",
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    texto: "Quanto entrou, de onde veio e quanto ainda falta receber.",
    itens: ["Receita por período, comparada ao anterior", "Receita por serviço e PIX contra no local", "Clientes que mais gastaram"],
    img: "financeiro",
    rota: "admin/financeiro",
  },
  {
    id: "marca",
    rotulo: "Sua marca",
    texto: "O cliente vê a sua estética do começo ao fim, não o Astro.",
    itens: ["Logo e cor principal da estética", "Endereço, WhatsApp e horário de funcionamento", "Link próprio para divulgar"],
    img: "identidade",
    rota: "admin/identidade",
  },
];

export function PorDentro() {
  const [ativa, setAtiva] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function teclado(e: KeyboardEvent, i: number) {
    const ultimo = ABAS.length - 1;
    const destino =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (destino === null) return;
    e.preventDefault();
    setAtiva(destino);
    botoes.current[destino]?.focus();
  }

  const aba = ABAS[ativa];

  return (
    <div>
      <div role="tablist" aria-label="Telas do painel" className="mb-8 flex flex-wrap justify-center gap-2">
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => {
              botoes.current[i] = el;
            }}
            role="tab"
            id={`aba-${a.id}`}
            aria-controls={`painel-${a.id}`}
            aria-selected={i === ativa}
            tabIndex={i === ativa ? 0 : -1}
            onClick={() => setAtiva(i)}
            onKeyDown={(e) => teclado(e, i)}
            className={`relative min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${
              i === ativa
                ? "border-transparent text-white"
                : "border-landing-line-strong text-landing-muted hover:border-landing-glow hover:text-landing-ink"
            }`}
          >
            {/* O fundo azul "desliza" de uma aba para a outra (layoutId). */}
            {i === ativa && (
              <motion.span
                layoutId="aba-ativa"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)]"
              />
            )}
            <span className="relative">{a.rotulo}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`painel-${aba.id}`}
        aria-labelledby={`aba-${aba.id}`}
        className="grid gap-6 rounded-[1.75rem] border border-landing-line bg-landing-card p-4 sm:p-8"
      >
        {/* Texto da aba em uma linha so, para o print ganhar espaco. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={aba.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10"
          >
            <div className="grid gap-1">
              <h3 className="text-2xl font-extrabold">{aba.rotulo}</h3>
              <p className="text-landing-muted">{aba.texto}</p>
            </div>
            <ul className="grid gap-1.5 text-sm lg:text-base">
              {aba.itens.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-landing-glow" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        {/* Janela de navegador com o print real. */}
        <div className="overflow-hidden rounded-2xl border border-landing-line-strong bg-[#0c0c0e] shadow-[0_30px_80px_-30px_rgba(37,99,235,0.45)]">
          <div className="flex items-center gap-3 border-b border-landing-line px-4 py-2.5">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-landing-card px-3 py-1 text-center font-mono text-xs text-landing-muted">
              …/sua-estetica/{aba.rota}
            </span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={aba.id}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Image
                src={`/landing/telas-admin/${aba.img}.webp`}
                alt={`Tela real do painel do Astro: ${aba.rotulo}`}
                width={1600}
                height={1000}
                sizes="(min-width: 72rem) 68rem, 100vw"
                className="block h-auto w-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
