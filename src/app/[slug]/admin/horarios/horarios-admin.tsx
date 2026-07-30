"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Info } from "lucide-react";
import { AdminHeader } from "../admin-header";

// UC09, RF02 — grade semanal de funcionamento (tela "Grade de horarios" do
// mockup do admin). Um dia desligado significa estetica fechada: a rota
// PUT /api/tenant/horarios remove o registro daquele dia.
//
// No mockup a capacidade e definida por dia da semana; hoje ela e uma so, do
// tenant inteiro (RN06), e fica na tela de Configuracoes. Por isso aqui ela
// aparece apenas como informacao, com link para onde se altera.

type HorarioDia = {
  diaSemana: number;
  nome: string;
  ativo: boolean;
  horaInicio: string;
  horaFim: string;
};

export function HorariosAdmin({
  horariosIniciais,
  capacidadeSimultanea,
  linkConfiguracoes,
}: {
  horariosIniciais: HorarioDia[];
  capacidadeSimultanea: number;
  linkConfiguracoes: string;
}) {
  const router = useRouter();
  const [horarios, setHorarios] = useState(horariosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function atualizarDia(
    diaSemana: number,
    campo: keyof HorarioDia,
    valor: string | boolean
  ) {
    setHorarios((atual) =>
      atual.map((h) => (h.diaSemana === diaSemana ? { ...h, [campo]: valor } : h))
    );
    setSucesso(null);
  }

  async function salvar() {
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    const resposta = await fetch("/api/tenant/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        horarios.map(({ diaSemana, ativo, horaInicio, horaFim }) => ({
          diaSemana,
          ativo,
          horaInicio,
          horaFim,
        }))
      ),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Nao foi possivel salvar a grade.");
      return;
    }
    setSucesso("Grade salva.");
    router.refresh();
  }

  const diasAbertos = horarios.filter((h) => h.ativo).length;

  return (
    <div className="space-y-4">
      {/* O botao de salvar mora na barra do topo, como no mockup */}
      <AdminHeader
        trilha="Operacao · Semana padrao"
        titulo="Grade de horarios"
        acao={
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-lg bg-astro-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar grade"}
          </button>
        }
      />

      <p className="text-sm text-astro-muted">
        {diasAbertos === 0
          ? "Nenhum dia de funcionamento definido."
          : `${diasAbertos} de 7 dias abertos.`}
      </p>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {sucesso}
        </p>
      )}

      <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 lg:p-6">
        <p className="astro-label">Dias de funcionamento</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Quando sua estetica atende
        </h2>

        <div className="mt-5 space-y-2">
          {horarios.map((dia) => (
            <div
              key={dia.diaSemana}
              className={
                dia.ativo
                  ? "flex flex-wrap items-center gap-4 rounded-xl border border-admin-border bg-admin-surface-2 px-4 py-3.5"
                  : "flex flex-wrap items-center gap-4 rounded-xl border border-admin-border px-4 py-3.5 opacity-50"
              }
            >
              {/* Interruptor do dia */}
              <label className="flex w-40 shrink-0 cursor-pointer items-center gap-3">
                <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={dia.ativo}
                    onChange={(e) =>
                      atualizarDia(dia.diaSemana, "ativo", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-admin-surface-2 transition peer-checked:bg-astro-blue" />
                  <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                </span>
                <span className="text-sm font-semibold text-white">{dia.nome}</span>
              </label>

              <div className="flex flex-wrap items-center gap-4">
                <CampoHora
                  rotulo="Abre"
                  valor={dia.horaInicio}
                  ativo={dia.ativo}
                  onChange={(v) => atualizarDia(dia.diaSemana, "horaInicio", v)}
                />
                <CampoHora
                  rotulo="Fecha"
                  valor={dia.horaFim}
                  ativo={dia.ativo}
                  onChange={(v) => atualizarDia(dia.diaSemana, "horaFim", v)}
                />
              </div>

              <span className="ml-auto font-mono text-xs text-astro-muted">
                {dia.ativo ? `${capacidadeSimultanea} carros / horario` : "fechado"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Explicacao da capacidade, como no rodape do mockup */}
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-astro-blue/30 bg-astro-blue/10 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-astro-blue/20 text-astro-blue-bright">
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Capacidade simultanea</p>
          <p className="text-sm text-astro-muted">
            Quantos veiculos podem ser atendidos ao mesmo tempo em cada horario.
            Hoje o valor e {capacidadeSimultanea} para todos os dias.
          </p>
        </div>
        <a
          href={linkConfiguracoes}
          className="shrink-0 text-sm font-semibold text-astro-blue-bright hover:underline"
        >
          Alterar →
        </a>
      </section>
    </div>
  );
}

// Campo de hora com o icone de relogio dentro, como no mockup. Dia desligado
// deixa o campo esmaecido e travado.
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
    <div>
      <p className="astro-label">{rotulo}</p>
      <div
        className={`mt-1 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2 ${ativo ? "" : "opacity-40"}`}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-astro-muted" />
        <input
          type="time"
          value={valor}
          disabled={!ativo}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 bg-transparent font-mono text-sm text-slate-100 outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
