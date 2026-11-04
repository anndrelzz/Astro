// Agendamento feito pelo Admin pelo cliente "coringa" (decisao do orientador,
// 30/10): o cliente de verdade e quem chamou no WhatsApp ou no Instagram, com
// o nome e o telefone anotados no proprio agendamento.

type ComContato = { contatoNome: string | null; usuario: { nome: string } };

// Quem aparece nas telas e no CSV: quem chamou, ou o dono da conta.
export function nomeDoCliente(a: ComContato): string {
  return a.contatoNome ?? a.usuario.nome;
}

export type ContatoDoAdmin = {
  telefone: string;
  nome: string;
  agendamentos: number;
  ultimoISO: string | null;
  proximoISO: string | null;
  /** Do mais recente ao mais antigo, sem repetir: "Civic · QWE1R23". */
  carros: string[];
};

type AgendamentoDoCoringa = {
  contatoNome: string | null;
  contatoTelefone: string | null;
  dataHora: Date;
  status: string;
  veiculo: { modelo: string; placa: string };
};

// Junta os agendamentos do coringa por telefone: a mesma pessoa que chama de
// novo e um contato so, com o nome que o Admin anotou por ultimo. Cancelado
// nao conta. Ordem: quem esteve (ou vai estar) na loja mais perto de hoje.
export function agruparContatosDoAdmin(agendamentos: AgendamentoDoCoringa[], agora: Date): ContatoDoAdmin[] {
  const agoraMs = agora.getTime();
  const porTelefone = new Map<string, AgendamentoDoCoringa[]>();
  for (const a of agendamentos) {
    if (!a.contatoTelefone) continue;
    const lista = porTelefone.get(a.contatoTelefone) ?? [];
    lista.push(a);
    porTelefone.set(a.contatoTelefone, lista);
  }

  const contatos = [...porTelefone.entries()].map(([telefone, lista]) => {
    const recentes = [...lista].sort((x, y) => y.dataHora.getTime() - x.dataHora.getTime());
    const validos = recentes.filter((a) => a.status !== "CANCELADO");
    const passados = validos.filter((a) => a.dataHora.getTime() <= agoraMs);
    const futuros = validos.filter((a) => a.dataHora.getTime() > agoraMs);
    const carros = [
      ...new Set(recentes.map((a) => (a.veiculo.placa ? `${a.veiculo.modelo} · ${a.veiculo.placa}` : a.veiculo.modelo))),
    ];
    const ultimo = passados[0]?.dataHora ?? null;
    const proximo = futuros.at(-1)?.dataHora ?? null;
    return {
      contato: {
        telefone,
        nome: recentes[0].contatoNome ?? "",
        agendamentos: validos.length,
        ultimoISO: ultimo?.toISOString() ?? null,
        proximoISO: proximo?.toISOString() ?? null,
        carros,
      },
      referenciaMs: (proximo ?? ultimo ?? recentes[0].dataHora).getTime(),
    };
  });

  // Mais perto de hoje primeiro, para frente ou para tras.
  return contatos
    .sort((x, y) => Math.abs(x.referenciaMs - agoraMs) - Math.abs(y.referenciaMs - agoraMs))
    .map((c) => c.contato);
}
