import "server-only";
import type { TipoNotificacao } from "@/generated/prisma/enums";
import { DOMINIO } from "@/compartilhado/dominio";
import {
  AVISO_DO_PIX,
  dataDoEmail,
  escapar,
  linhaDoPrazo,
  linkDoCodigoPix,
  linkDoWhatsApp,
  reais,
  TITULOS,
  type DadosDoEmail,
} from "@/back/notificacoes/modelo-email";

// RF08, RF09 — a mensagem do bot, com os mesmos dados e regras do e-mail
// (modelo-email.ts): titulo, estetica, o agendamento em linhas curtas, o prazo
// de cancelamento e botoes. O Telegram le HTML simples com parse_mode "HTML",
// entao todo texto do banco passa por `escapar`.

export type BotaoTelegram = { texto: string; url: string };

const SITE = `https://${DOMINIO}`;

const ICONE: Record<TipoNotificacao, string> = {
  CONFIRMACAO_AGENDAMENTO: "✅",
  LEMBRETE_24H: "⏰",
  LEMBRETE_2H: "⏰",
  CONFIRMACAO_CANCELAMENTO: "❌",
  RESERVA_PIX: "⏳",
  PAGAMENTO_CONFIRMADO: "✅",
  // Avisos ao dono saem so por e-mail; o icone fica para o Record completo.
  AVISO_NOVO_AGENDAMENTO: "🆕",
  AVISO_CANCELAMENTO: "❌",
};

export function montarTelegram(d: DadosDoEmail): { texto: string; botoes: BotaoTelegram[] } {
  const cancelado = d.tipo === "CONFIRMACAO_CANCELAMENTO";
  const quando = dataDoEmail(d.dataHora);
  const carro = [`${d.veiculo.marca} ${d.veiculo.modelo}`.trim(), d.veiculo.placa].filter(Boolean).join(" · ");
  const pagamento = d.formaPagamento === "PIX" ? "PIX" : "no local";
  const prazo = linhaDoPrazo(d);

  const linhas = [
    `${ICONE[d.tipo]} <b>${escapar(TITULOS[d.tipo].titulo)}</b>`,
    escapar(d.estetica.nome),
    "",
    `<b>${escapar(d.servicoNome)}</b>`,
    `📅 ${escapar(quando)}`,
    `🚗 ${escapar(carro)}`,
    `💳 ${escapar(`${reais(d.valor)} · ${pagamento}`)}`,
  ];
  if (d.tipo === "RESERVA_PIX") linhas.push("", escapar(AVISO_DO_PIX));
  if (prazo) linhas.push("", `<i>${escapar(prazo)}</i>`);

  const botoes: BotaoTelegram[] = [
    cancelado
      ? { texto: "Agendar outro horário", url: `${SITE}/${d.estetica.slug}` }
      : d.tipo === "RESERVA_PIX"
        ? { texto: "Ver código PIX", url: linkDoCodigoPix(d) }
        : { texto: "Ver meus agendamentos", url: `${SITE}/${d.estetica.slug}/historico` },
  ];
  if (d.estetica.whatsapp) {
    const mensagem = cancelado
      ? `Olá! Meu agendamento de ${d.servicoNome} para ${quando} foi cancelado e quero remarcar.`
      : `Olá! Tenho um agendamento de ${d.servicoNome} para ${quando}.`;
    botoes.push({
      texto: cancelado ? "Remarcar pelo WhatsApp" : "Falar no WhatsApp",
      url: linkDoWhatsApp(d.estetica.whatsapp, mensagem),
    });
  }

  return { texto: linhas.join("\n"), botoes };
}
