import { chaveDia, inicioDoDia, instanteNoFuso } from "@/compartilhado/fuso";

// Quantos dias a frente o cliente pode agendar, contando hoje. A tela de
// agendamento mostra exatamente esses dias; o servidor confere o mesmo limite,
// porque um pedido montado fora da tela pode trazer qualquer data.
//
// Importado pela tela (componente client): nada de servidor aqui.
export const JANELA_AGENDAMENTO_DIAS = 14;

/**
 * Confere uma data "AAAA-MM-DD" vinda do cliente. Devolve a mensagem de erro,
 * ou null se a data existe e esta entre hoje e o ultimo dia da janela, no
 * relogio da estetica.
 *
 * "Existe" importa porque instanteNoFuso normaliza como o Date.UTC: 31/02 vira
 * 03/03 em silencio, e o cliente ficaria agendado num dia que nao escolheu.
 */
export function conferirDataAgendamento(data: string, agora: Date = new Date()): string | null {
  // Fora do formato, o split gera NaN e o Date invalido faz o chaveDia lancar.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return "Data invalida";
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  if (chaveDia(instanteNoFuso(ano, mes, dia)) !== data) {
    return "Data invalida";
  }

  // "AAAA-MM-DD" ordena como texto na mesma ordem do calendario.
  const hoje = chaveDia(agora);
  const ultimoDia = chaveDia(inicioDoDia(agora, JANELA_AGENDAMENTO_DIAS - 1));
  if (data < hoje || data > ultimoDia) {
    return `Escolha uma data entre hoje e os proximos ${JANELA_AGENDAMENTO_DIAS} dias`;
  }

  return null;
}
