"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { FundoOndas } from "@/front/componentes/fundo-ondas";
import { SuccessScreen } from "@/front/componentes/success-screen";
import { ThemeColor } from "@/front/componentes/theme-color";
import { horaMinuto, partesNoFuso } from "@/compartilhado/fuso";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_ABR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const MESES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Cada status tem seu proprio rotulo. PIX cai aqui como pendente ate o Admin
// confirmar o recebimento (RN05), entao a tela nao pode cravar "confirmado"
// para todo mundo — o titulo acompanha o estado real do agendamento.
const COPY: Record<string, { titulo: string; realce: string }> = {
  CONFIRMADO: { titulo: "Agendamento", realce: "confirmado" },
  CONCLUIDO: { titulo: "Serviço", realce: "concluído" },
  PIX_PENDENTE: { titulo: "Agendamento", realce: "reservado" },
  PENDENTE_PAGAMENTO: { titulo: "Agendamento", realce: "reservado" },
};

function pagamentoRotulo(forma: string, status: string) {
  if (forma === "PIX") return status === "CONFIRMADO" ? "PIX · Pago" : "PIX · Pendente";
  return "No local";
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Tela 12 — confirmacao do agendamento. No celular e uma coluna sob o fundo
// escuro; a partir de lg o card de detalhes vira uma faixa horizontal (bloco
// de data + grade de seis campos) e as acoes ficam lado a lado.
//
// Antes de a tela aparecer, roda a mesma animacao de sucesso do login. Ela
// toca UMA vez por agendamento: se o cliente voltar a esta URL (back do
// navegador, refresh), a tela ja aparece pronta.
export function ConfirmadoCliente({
  slug,
  agendamentoId,
  status,
  estetica,
  servico,
  veiculo,
  dataISO,
  duracaoMin,
  formaPagamento,
  valor,
  acrescimoCondicaoPercent,
  emailEnviado,
}: {
  slug: string;
  agendamentoId: string;
  status: string;
  estetica: string;
  servico: string;
  veiculo: string;
  dataISO: string;
  duracaoMin: number;
  formaPagamento: string;
  valor: number;
  // Repetido aqui de proposito: o cliente aceitou o aviso no agendamento, mas
  // o atendimento pode ser dias depois. Ver o teto de novo na tela que ele
  // guarda evita a surpresa chegar na estetica.
  acrescimoCondicaoPercent: number | null;
  // O e-mail de confirmacao sai de verdade (Resend configurado). Sem isso a
  // tela nao promete um e-mail que nao chega.
  emailEnviado: boolean;
}) {
  const copy = COPY[status] ?? COPY.PENDENTE_PAGAMENTO;

  // Comeca em "animando" para o servidor e o cliente renderizarem igual (sem
  // mismatch de hidratacao). O efeito so decide QUANTO tempo ela fica: a
  // primeira visita a este agendamento leva os ~2,3s cheios (mesmo tempo do
  // login); numa revisita — back do navegador, refresh — ela sai de imediato e
  // a tela ja aparece pronta, sem repetir a celebracao.
  const [animando, setAnimando] = useState(true);
  useEffect(() => {
    const chave = `astro:confirmado:${agendamentoId}`;
    let jaViu = false;
    try {
      jaViu = sessionStorage.getItem(chave) === "1";
    } catch {
      // sessionStorage indisponivel (aba privada) — segue com a animacao cheia
    }
    // A marca de "ja viu" so e gravada QUANDO a animacao termina, nunca no
    // inicio do efeito: em dev o React monta o efeito duas vezes, e gravar
    // cedo faria a segunda montagem enxergar a animacao como ja assistida.
    const t = setTimeout(() => {
      setAnimando(false);
      try {
        sessionStorage.setItem(chave, "1");
      } catch {
        // idem — sem persistir, a animacao volta a rodar num proximo acesso
      }
    }, jaViu ? 0 : 2300);
    return () => clearTimeout(t);
  }, [agendamentoId]);

  const d = new Date(dataISO);
  const fim = new Date(d.getTime() + duracaoMin * 60000);
  const faixa = `${horaMinuto(d)} – ${horaMinuto(fim)}`;
  const pd = partesNoFuso(d);

  const campos = [
    { rotulo: "Serviço", texto: servico },
    { rotulo: "Veículo", texto: veiculo },
    { rotulo: "Horário", texto: faixa },
    { rotulo: "Local", texto: estetica },
    { rotulo: "Forma de pagamento", texto: pagamentoRotulo(formaPagamento, status) },
    {
      rotulo: "Valor",
      texto: acrescimoCondicaoPercent
        ? `${BRL(valor)} · até ${BRL(valor * (1 + acrescimoCondicaoPercent / 100))}`
        : BRL(valor),
    },
  ];

  return (
    // Fundo preto liso, como no login: o .astro-dark tem listras diagonais
    // proprias, que apareciam por baixo dos pontos.
    <div className="relative isolate min-h-dvh overflow-hidden bg-black">
      <ThemeColor color="#09090b" />

      {/* Fundo padrao do projeto (pontos com ondas de luz na cor da estetica),
          o mesmo do login e do Admin, e um brilho radial no topo, atras do
          check. */}
      <FundoOndas />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(55% 40% at 50% 20%, color-mix(in srgb, var(--color-astro-blue) 35%, transparent) 0%, transparent 70%)",
        }}
      />

      <AnimatePresence>
        {animando && (
          <SuccessScreen
            title={`${copy.titulo} ${copy.realce}!`}
            subtitle="Preparando os detalhes…"
          />
        )}
      </AnimatePresence>

      {/* O conteudo entra suave assim que a animacao sai — nunca aparece do
          nada. Na revisita (animando ja comeca false) a transicao roda uma
          unica vez, bem rapida, sem incomodar. */}
      {!animando && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 py-12 text-center lg:max-w-3xl"
        >
          {/* Sem selo em cima: ele repetia o titulo, e a situacao do
              pagamento ja aparece no cartao, em "Forma de pagamento". */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-astro-blue shadow-[0_0_60px] shadow-astro-blue/50 lg:h-28 lg:w-28">
            <Check className="h-10 w-10 text-white lg:h-12 lg:w-12" strokeWidth={3} />
          </div>

          <h1 className="mt-8 text-3xl font-bold text-white lg:text-5xl">
            {copy.titulo}{" "}
            <span className="italic text-astro-blue-bright">{copy.realce}</span>
          </h1>
          <p className="mt-3 text-sm text-astro-muted lg:text-base">
            {emailEnviado
              ? "Enviamos os detalhes do agendamento para o seu e-mail."
              : "Os detalhes ficam salvos em Meus agendamentos."}
          </p>

          {/* Card de detalhes. No celular empilha; no desktop vira faixa
              horizontal: bloco de data a esquerda e os seis campos numa grade
              de tres colunas. */}
          <div className="mt-8 w-full rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur lg:mt-10 lg:flex lg:gap-6 lg:p-6">
            <div className="flex items-center gap-4 lg:shrink-0">
              <div className="flex flex-col items-center justify-center rounded-2xl bg-astro-blue px-4 py-3 text-white lg:h-full lg:px-6 lg:py-5">
                <span className="text-[0.55rem] font-medium uppercase tracking-widest opacity-80">
                  {MESES_ABR[pd.mes - 1]} {pd.ano}
                </span>
                <span className="text-2xl font-bold leading-none lg:text-4xl">
                  {pd.dia}
                </span>
                <span className="text-[0.55rem] uppercase tracking-widest opacity-80">
                  {DIAS[pd.diaSemana]}
                </span>
              </div>
              {/* Data por extenso — so no celular. No desktop o bloco azul e a
                  celula "Horário" da grade ja dizem tudo. */}
              <div className="lg:hidden">
                <p className="astro-label">Data e horário</p>
                <p className="font-semibold text-white">
                  {pd.dia} de {MESES_LONGO[pd.mes - 1]}
                </p>
                <p className="text-sm text-astro-muted">{faixa}</p>
              </div>
            </div>

            <div className="mt-4 grid flex-1 grid-cols-2 gap-x-4 gap-y-4 border-t border-white/10 pt-4 lg:mt-0 lg:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              {campos.map((c) => (
                <div key={c.rotulo}>
                  <p className="astro-label">{c.rotulo}</p>
                  <p className="mt-1 font-semibold text-white">{c.texto}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Acoes — empilhadas no celular, lado a lado no desktop. */}
          <div className="mt-8 flex w-full flex-col gap-3 lg:mt-10 lg:max-w-xl lg:flex-row-reverse">
            <Link
              href={`/${slug}/historico`}
              className="flex flex-1 items-center justify-between rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-astro-bg transition hover:bg-white/90"
            >
              <span className="flex-1 text-center">Ver detalhes do agendamento</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-astro-bg text-white">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href={`/${slug}`}
              className="flex flex-1 items-center justify-center rounded-xl border border-white/10 py-3.5 text-sm font-medium text-astro-muted transition hover:border-white/20 hover:text-white"
            >
              Voltar ao início
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
