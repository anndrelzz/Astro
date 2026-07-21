"use client";

import { useEffect, useState } from "react";

function formatarISO(data: Date) {
  const offset = data.getTimezoneOffset();
  return new Date(data.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function primeiroDiaDoMes() {
  const hoje = new Date();
  return formatarISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
}

type Resultado = {
  receitaTotal: number;
  totalAgendamentos: number;
  porServico: { servicoId: string; nome: string; receita: number; quantidade: number }[];
};

export function FinanceiroDashboard() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(formatarISO(new Date()));
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/financeiro?inicio=${inicio}&fim=${fim}`)
      .then((r) => r.json())
      .then(setDados)
      .finally(() => setCarregando(false));
  }, [inicio, fim]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            De
          </label>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Ate
          </label>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      {carregando && <p className="text-sm text-zinc-500">Carregando...</p>}

      {dados && !carregando && (
        <>
          <div className="flex gap-6">
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Receita no periodo</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                R$ {dados.receitaTotal.toFixed(2).replace(".", ",")}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Agendamentos pagos</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {dados.totalAgendamentos}
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Receita por servico
            </h2>
            <table className="mt-2 w-full max-w-lg text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="py-2">Servico</th>
                  <th className="py-2">Qtd.</th>
                  <th className="py-2">Receita</th>
                </tr>
              </thead>
              <tbody>
                {dados.porServico.map((item) => (
                  <tr
                    key={item.servicoId}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-2">{item.nome}</td>
                    <td className="py-2">{item.quantidade}</td>
                    <td className="py-2">
                      R$ {item.receita.toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                ))}
                {dados.porServico.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-zinc-500">
                      Nenhuma receita confirmada nesse periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
