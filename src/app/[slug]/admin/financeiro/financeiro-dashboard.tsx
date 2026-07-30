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
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    fetch(`/api/financeiro?inicio=${inicio}&fim=${fim}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setErro(json.error ?? "Nao foi possivel carregar.");
          setDados(null);
          return;
        }
        setDados(json);
      })
      .finally(() => setCarregando(false));
  }, [inicio, fim]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm text-astro-muted">
            De
          </label>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded border border-admin-border bg-admin-surface-2 px-3 py-2 text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm text-astro-muted">
            Ate
          </label>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="rounded border border-admin-border bg-admin-surface-2 px-3 py-2 text-slate-100"
          />
        </div>
      </div>

      {carregando && <p className="text-sm text-astro-muted">Carregando...</p>}
      {erro && !carregando && <p className="text-sm text-red-600">{erro}</p>}

      {dados && !carregando && !erro && (
        <>
          <div className="flex gap-6">
            <div className="rounded-lg border border-admin-border bg-admin-surface p-4">
              <p className="text-sm text-astro-muted">Receita no periodo</p>
              <p className="text-2xl font-semibold text-white">
                R$ {dados.receitaTotal.toFixed(2).replace(".", ",")}
              </p>
            </div>
            <div className="rounded-lg border border-admin-border bg-admin-surface p-4">
              <p className="text-sm text-astro-muted">Agendamentos pagos</p>
              <p className="text-2xl font-semibold text-white">
                {dados.totalAgendamentos}
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-medium text-white">
              Receita por servico
            </h2>
            <table className="mt-2 w-full max-w-lg text-sm">
              <thead>
                <tr className="border-b border-admin-border text-left text-astro-muted">
                  <th className="py-2">Servico</th>
                  <th className="py-2">Qtd.</th>
                  <th className="py-2">Receita</th>
                </tr>
              </thead>
              <tbody>
                {dados.porServico.map((item) => (
                  <tr
                    key={item.servicoId}
                    className="border-b border-admin-border"
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
                    <td colSpan={3} className="py-4 text-astro-muted">
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
