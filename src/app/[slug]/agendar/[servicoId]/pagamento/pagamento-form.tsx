"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Diamond, Wallet, Check } from "lucide-react";
import Link from "next/link";
import { ThemeColor } from "@/components/ui/theme-color";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_ABR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function horaFim(hora: string, duracaoMin: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + duracaoMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Tela 10 — forma de pagamento. Cria o agendamento e roteia para PIX (tela
// 11) ou confirmacao (tela 12) conforme a escolha.
//
// No celular e uma coluna com o total no cabecalho escuro e o botao preso no
// rodape. A partir de lg vira o desenho do mockup: os metodos a esquerda e um
// cartao "Resumo do pedido" a direita, que carrega o total e o botao.
export function PagamentoForm({
  slug,
  servicoId,
  veiculoId,
  data,
  hora,
  servico,
  veiculo,
  segmento,
  preco,
  pixDisponivel,
  cancelamentoHorasLimite,
}: {
  slug: string;
  servicoId: string;
  veiculoId: string;
  data: string;
  hora: string;
  servico: { nome: string; duracaoMin: number };
  veiculo: { marca: string; modelo: string; placa: string; cor: string };
  segmento: string;
  preco: number;
  pixDisponivel: boolean;
  // RF18 — a antecedencia e configurada pelo Admin (UC14). O aviso no resumo
  // le esse numero em vez de repetir "24h" fixo, que seria mentira para quem
  // configurou outra janela.
  cancelamentoHorasLimite: number;
}) {
  const router = useRouter();
  const [forma, setForma] = useState<"PIX" | "LOCAL">(
    pixDisponivel ? "PIX" : "LOCAL"
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const d = new Date(data + "T00:00:00");
  const dataFmt = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_ABR[d.getMonth()]}`;
  const precoFmt = preco.toFixed(2).replace(".", ",");

  async function confirmar() {
    setErro(null);
    setEnviando(true);

    const resposta = await fetch("/api/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicoId, veiculoId, data, hora, formaPagamento: forma }),
    });

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível concluir o agendamento.");
      setEnviando(false);
      return;
    }

    const json = await resposta.json();
    if (json.status === "PIX_PENDENTE") {
      router.push(`/${slug}/pagamento/${json.id}`);
    } else {
      router.push(`/${slug}/confirmado/${json.id}`);
    }
  }

  const acaoRotulo = enviando
    ? "Processando..."
    : forma === "PIX"
      ? "Continuar com PIX"
      : "Confirmar agendamento";

  return (
    <div className="min-h-dvh bg-white lg:min-h-0 lg:bg-transparent">
      <ThemeColor color="#0b1120" />
      {/* Cabecalho escuro com total — so no celular. */}
      <div className="astro-dark px-5 pb-12 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:hidden">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link
              href={`/${slug}/agendar/${servicoId}`}
              aria-label="Voltar"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-semibold text-white">Pagamento</h1>
            <span className="h-11 w-11" />
          </div>
          <div className="mt-6 text-center">
            <p className="astro-label">Total a pagar</p>
            <p className="text-4xl font-bold text-white">R$ {precoFmt}</p>
          </div>
        </div>
      </div>

      {/* Sheet claro no celular; grade de duas colunas no desktop. */}
      <div className="mx-auto -mt-4 max-w-md rounded-t-3xl bg-white px-5 pb-32 pt-6 lg:mx-0 lg:mt-0 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6 lg:rounded-none lg:bg-transparent lg:px-8 lg:pb-10 lg:pt-0">
        <div>
        {/* Resumo curto — no desktop essa informacao esta no cartao da direita. */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm lg:hidden">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-astro-surface-2 to-astro-bg" />
          <div className="flex-1">
            <p className="font-semibold text-zinc-900">{servico.nome}</p>
            <p className="text-xs text-zinc-500">
              {dataFmt} · {hora}–{horaFim(hora, servico.duracaoMin)}
            </p>
          </div>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-[0.65rem] font-semibold text-zinc-500">
            {segmento}
          </span>
        </div>

        <p className="mt-6 astro-label lg:mt-0">Forma de pagamento</p>
        <h2 className="mt-1 text-xl font-bold text-zinc-900">
          <span className="lg:hidden">Como prefere pagar?</span>
          <span className="hidden lg:inline">Selecione um método</span>
        </h2>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        <div className="mt-4 space-y-3">
          {pixDisponivel && (
            <button
              onClick={() => setForma("PIX")}
              className={
                forma === "PIX"
                  ? "flex w-full items-center gap-3 rounded-2xl border-2 border-astro-blue bg-astro-blue/5 p-4 text-left"
                  : "flex w-full items-center gap-3 rounded-2xl border border-zinc-200 p-4 text-left"
              }
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-astro-blue text-white">
                <Diamond className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  Pagar com PIX
                  <span className="rounded-full bg-astro-blue/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-astro-blue">
                    Instantâneo
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  Copia e cola. Garante seu horário.
                </p>
              </div>
              {forma === "PIX" && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-astro-blue text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setForma("LOCAL")}
            className={
              forma === "LOCAL"
                ? "flex w-full items-center gap-3 rounded-2xl border-2 border-astro-blue bg-astro-blue/5 p-4 text-left"
                : "flex w-full items-center gap-3 rounded-2xl border border-zinc-200 p-4 text-left"
            }
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-zinc-900">Pagar no local</p>
              <p className="text-xs text-zinc-500">
                Dinheiro ou cartão na hora do serviço.
              </p>
            </div>
            {forma === "LOCAL" && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-astro-blue text-white">
                <Check className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>
        </div>

        {/* Resumo do pedido (tela 10 do mockup). So no desktop: no celular o
            total ja esta no cabecalho escuro e a acao no botao do rodape. */}
        <aside className="hidden rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm lg:sticky lg:top-4 lg:block">
          <p className="astro-label">Resumo do pedido</p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900">{servico.nome}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {dataFmt} · {hora} – {horaFim(hora, servico.duracaoMin)}
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-astro-surface-2 to-astro-bg text-[0.6rem] font-semibold text-white">
              {segmento}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900">
                {veiculo.marca} {veiculo.modelo}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {veiculo.placa} · {segmento} · {veiculo.cor}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm">
            <span className="text-zinc-500">{servico.nome}</span>
            <span className="text-zinc-900">R$ {precoFmt}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Taxa de serviço</span>
            <span className="text-zinc-900">R$ 0,00</span>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-zinc-100 pt-4">
            <span className="astro-label">Total</span>
            <span className="text-2xl font-bold text-zinc-900">R$ {precoFmt}</span>
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="mt-5 flex w-full items-center justify-between gap-2 rounded-xl bg-astro-blue px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            {acaoRotulo}
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            {cancelamentoHorasLimite > 0
              ? `Cancelamento gratuito até ${cancelamentoHorasLimite}h antes do serviço.`
              : "Cancelamento gratuito a qualquer momento antes do serviço."}
          </p>
        </aside>
      </div>

      {/* Botao fixo — celular. No desktop a acao vive no resumo. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-100 bg-white/95 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-md">
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            {enviando ? "Processando..." : forma === "PIX" ? "Gerar PIX" : "Confirmar agendamento"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
