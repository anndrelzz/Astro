import "server-only";
import type { FormaPagamento, TipoNotificacao } from "@/generated/prisma/enums";
import { DOMINIO } from "@/compartilhado/dominio";
import { FUSO } from "@/compartilhado/fuso";

// RF08, RF09 — o e-mail em HTML que o cliente recebe. A estetica fica no topo
// (foi com ela que o cliente marcou) e o Astro no rodape.
//
// Programa de e-mail nao e navegador: o Outlook ignora CSS moderno (flex,
// grid, classes) e o Gmail apaga o <style>. Por isso o layout e feito com
// tabelas e com o estilo escrito em cada tag. Tudo o que veio do banco passa
// por `escapar`: nome da estetica e do cliente sao texto digitado por alguem.

export type DadosDoEmail = {
  tipo: TipoNotificacao;
  clienteNome: string;
  estetica: {
    nome: string;
    slug: string;
    logoUrl: string | null;
    /** So digitos, com DDD (como a validacao do Admin grava). */
    whatsapp: string | null;
    cancelamentoHorasLimite: number;
  };
  servicoNome: string;
  veiculo: { marca: string; modelo: string; placa: string };
  dataHora: Date;
  valor: number;
  formaPagamento: FormaPagamento;
  /** Momento do envio: decide se o cliente ainda pode cancelar pelo site. */
  agora: Date;
};

const SITE = `https://${DOMINIO}`;
const HORA_EM_MS = 60 * 60 * 1000;

const COR = {
  fundo: "#f4f4f5",
  escuro: "#09090b",
  texto: "#18181b",
  suave: "#52525b",
  rotulo: "#71717a",
  linha: "#e4e4e7",
  azul: "#2563eb",
};

export const TITULOS: Record<TipoNotificacao, { titulo: string; selo: string; corDoSelo: string }> = {
  CONFIRMACAO_AGENDAMENTO: { titulo: "Agendamento confirmado", selo: "&#10003;", corDoSelo: "#10b981" },
  LEMBRETE_24H: { titulo: "Seu agendamento é amanhã", selo: "24h", corDoSelo: COR.azul },
  LEMBRETE_2H: { titulo: "Seu agendamento é daqui a 2 horas", selo: "2h", corDoSelo: COR.azul },
  CONFIRMACAO_CANCELAMENTO: { titulo: "Agendamento cancelado", selo: "&#10005;", corDoSelo: "#ef4444" },
};

const CHAMADAS: Record<TipoNotificacao, string> = {
  CONFIRMACAO_AGENDAMENTO: "Seu horário está reservado. Te esperamos!",
  LEMBRETE_24H: "Passando para lembrar do seu horário de amanhã.",
  LEMBRETE_2H: "Seu horário é daqui a pouco.",
  CONFIRMACAO_CANCELAMENTO: "Seu agendamento foi cancelado. Se quiser, escolha outro horário.",
};

export function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "quinta, 13/11 às 10:00", sempre no fuso de Brasilia: o servidor na nuvem
// roda em UTC e, sem o timeZone, o cliente das 10:00 leria 13:00.
export function dataDoEmail(d: Date): string {
  const semana = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long" }).split("-")[0];
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${semana}, ${dia} às ${hora}`;
}

export function reais(valor: number): string {
  // O Intl separa "R$" do numero com espaco inquebravel; aqui um espaco comum
  // basta e nao confunde quem copia o valor.
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

export function linkDoWhatsApp(whatsapp: string, mensagem: string): string {
  return `https://wa.me/55${whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

// RF18 — a mesma regra da rota de cancelamento: pode cancelar enquanto faltar
// pelo menos o prazo da estetica. Dentro do prazo, prometer o cancelamento
// pelo site seria prometer algo que a rota recusa.
export function linhaDoPrazo(d: DadosDoEmail): string | null {
  if (d.tipo === "CONFIRMACAO_CANCELAMENTO") return null;

  const limite = d.estetica.cancelamentoHorasLimite;
  const horasAte = (d.dataHora.getTime() - d.agora.getTime()) / HORA_EM_MS;
  if (horasAte >= limite) {
    if (limite === 0) return "Precisa cancelar? Faça pelo site até o horário do agendamento.";
    return `Precisa cancelar? Faça pelo site até ${limite} ${limite === 1 ? "hora" : "horas"} antes do horário.`;
  }
  return d.estetica.whatsapp
    ? "Precisa remarcar? Fale com a estética pelo WhatsApp."
    : "Precisa remarcar? Fale com a estética.";
}

function botao(href: string, rotulo: string, principal: boolean): string {
  const estilo = principal
    ? `background:${COR.azul};color:#ffffff;border:1px solid ${COR.azul};`
    : `background:#ffffff;color:${COR.texto};border:1px solid #d4d4d8;`;
  return `<tr><td style="padding-top:10px;">
<a href="${escapar(href)}" target="_blank" style="${estilo}display:block;padding:12px;border-radius:10px;font-size:14px;font-weight:bold;text-align:center;text-decoration:none;">${escapar(rotulo)}</a>
</td></tr>`;
}

function linhaDoDetalhe(rotulo: string, valor: string, primeira: boolean): string {
  const borda = primeira ? "" : `border-top:1px solid #f4f4f5;`;
  return `<tr>
<td style="${borda}padding:10px 0;font-size:14px;color:${COR.rotulo};">${rotulo}</td>
<td style="${borda}padding:10px 0;font-size:14px;color:${COR.texto};text-align:right;">${valor}</td>
</tr>`;
}

export function montarEmailHtml(d: DadosDoEmail): string {
  const { titulo, selo, corDoSelo } = TITULOS[d.tipo];
  const cancelado = d.tipo === "CONFIRMACAO_CANCELAMENTO";
  const quando = dataDoEmail(d.dataHora);
  const primeiroNome = d.clienteNome.trim().split(/\s+/)[0] ?? "";

  const pagamento = d.formaPagamento === "PIX" ? "PIX" : "no local";
  const detalhes = [
    linhaDoDetalhe("Serviço", escapar(d.servicoNome), true),
    linhaDoDetalhe("Data", escapar(quando), false),
    linhaDoDetalhe(
      "Veículo",
      escapar(`${d.veiculo.marca} ${d.veiculo.modelo} · ${d.veiculo.placa}`),
      false
    ),
    linhaDoDetalhe("Valor", `<strong>${escapar(`${reais(d.valor)} · ${pagamento}`)}</strong>`, false),
  ].join("");

  const botoes = [
    cancelado
      ? botao(`${SITE}/${d.estetica.slug}`, "Agendar outro horário", true)
      : botao(`${SITE}/${d.estetica.slug}/historico`, "Ver meus agendamentos", true),
  ];
  if (d.estetica.whatsapp) {
    const mensagem = cancelado
      ? `Olá! Meu agendamento de ${d.servicoNome} para ${quando} foi cancelado e quero remarcar.`
      : `Olá! Tenho um agendamento de ${d.servicoNome} para ${quando}.`;
    botoes.push(
      botao(
        linkDoWhatsApp(d.estetica.whatsapp, mensagem),
        cancelado ? "Remarcar pelo WhatsApp" : "Falar no WhatsApp",
        false
      )
    );
  }

  const prazo = linhaDoPrazo(d);
  // Texto escondido que o Gmail mostra ao lado do assunto, na lista de e-mails.
  const previa = escapar(`${titulo}: ${d.servicoNome}, ${quando}.`);

  return casca({
    estetica: d.estetica,
    titulo,
    previa,
    corpo: `<tr><td style="padding:24px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="44" height="44" align="center" style="width:44px;height:44px;border-radius:22px;background:${corDoSelo};color:#ffffff;font-size:${selo.startsWith("&") ? "20px" : "14px"};font-weight:bold;">${selo}</td>
</tr></table>
<div style="margin:16px 0 4px;font-size:20px;font-weight:bold;color:${COR.texto};">${escapar(titulo)}</div>
<div style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${COR.suave};">Olá, ${escapar(primeiroNome)}. ${escapar(CHAMADAS[d.tipo])}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COR.linha};border-radius:10px;">
<tr><td style="padding:4px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detalhes}</table>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${botoes.join("")}</table>
${prazo ? `<div style="margin-top:16px;font-size:12px;line-height:1.6;color:${COR.rotulo};">${escapar(prazo)}</div>` : ""}
</td></tr>`,
  });
}

type EsteticaDoEmail = { nome: string; slug: string; logoUrl: string | null };

// O envelope de todo e-mail do Astro: o topo escuro com o logo (ou a inicial)
// e o nome da estetica, o corpo, e o rodape com o ASTRO cortado. `previa` e o
// texto escondido que o Gmail mostra ao lado do assunto na caixa de entrada.
function casca({
  estetica,
  titulo,
  previa,
  corpo,
}: {
  estetica: EsteticaDoEmail;
  titulo: string;
  previa: string;
  corpo: string;
}): string {
  const marca = estetica.logoUrl
    ? `<img src="${escapar(SITE + estetica.logoUrl)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:10px;object-fit:cover;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="40" align="center" style="width:40px;height:40px;border-radius:10px;background:${COR.azul};color:#ffffff;font-size:18px;font-weight:bold;">${escapar(estetica.nome.trim()[0]?.toUpperCase() ?? "A")}</td></tr></table>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapar(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};font-family:Arial,Helvetica,sans-serif;color:${COR.texto};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previa}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${COR.linha};border-radius:12px;overflow:hidden;">

<tr><td style="background:${COR.escuro};padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px;">${marca}</td>
<td>
<div style="font-size:15px;font-weight:bold;color:#ffffff;">${escapar(estetica.nome)}</div>
<div style="font-size:12px;color:#a1a1aa;">${escapar(`${DOMINIO}/${estetica.slug}`)}</div>
</td>
</tr></table>
</td></tr>

${corpo}

<tr><td style="background:${COR.escuro};padding:20px 24px 0;">
<div style="font-size:12px;color:${COR.rotulo};">Enviado pelo Astro · não responda este e-mail</div>
<img src="${SITE}/email/astro-rodape.png" width="472" alt="Astro" style="display:block;width:100%;max-width:472px;height:auto;margin-top:18px;border:0;">
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// RFC 6.2 — o e-mail com o link de criar a senha nova. O link vale 1 hora e
// uma vez so (ver api/auth/esqueci-senha).
export function montarEmailRedefinicao({
  clienteNome,
  estetica,
  link,
}: {
  clienteNome: string;
  estetica: EsteticaDoEmail;
  link: string;
}): string {
  const primeiroNome = clienteNome.trim().split(/\s+/)[0] ?? "";
  return casca({
    estetica,
    titulo: "Redefinir sua senha",
    previa: escapar("Use o link para criar uma senha nova. Ele vale por 1 hora."),
    corpo: `<tr><td style="padding:24px;">
<div style="margin:0 0 4px;font-size:20px;font-weight:bold;color:${COR.texto};">Redefinir sua senha</div>
<div style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${COR.suave};">Olá, ${escapar(primeiroNome)}. Recebemos um pedido para criar uma senha nova na sua conta da ${escapar(estetica.nome)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${botao(link, "Criar nova senha", true)}</table>
<div style="margin-top:16px;font-size:12px;line-height:1.6;color:${COR.rotulo};">O link vale por 1 hora e funciona uma vez só. Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.</div>
</td></tr>`,
  });
}

// O e-mail com o link de confirmar o e-mail (enviado no cadastro e pelo
// "Reenviar" do Perfil). Sem confirmar, os avisos dos agendamentos nao saem
// por e-mail.
export function montarEmailConfirmacao({
  clienteNome,
  estetica,
  link,
}: {
  clienteNome: string;
  estetica: EsteticaDoEmail;
  link: string;
}): string {
  const primeiroNome = clienteNome.trim().split(/\s+/)[0] ?? "";
  return casca({
    estetica,
    titulo: "Confirme seu e-mail",
    previa: escapar("Confirme o e-mail para receber os avisos dos seus agendamentos."),
    corpo: `<tr><td style="padding:24px;">
<div style="margin:0 0 4px;font-size:20px;font-weight:bold;color:${COR.texto};">Confirme seu e-mail</div>
<div style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${COR.suave};">Olá, ${escapar(primeiroNome)}. Sua conta na ${escapar(estetica.nome)} está pronta. Confirme que este e-mail é seu para receber aqui a confirmação e os lembretes dos seus agendamentos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${botao(link, "Confirmar e-mail", true)}</table>
<div style="margin-top:16px;font-size:12px;line-height:1.6;color:${COR.rotulo};">O link vale por 7 dias. Se não foi você que criou a conta, ignore este e-mail.</div>
</td></tr>`,
  });
}
