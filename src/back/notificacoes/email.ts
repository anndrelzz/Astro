import "server-only";
import { Resend } from "resend";
import { DOMINIO } from "@/compartilhado/dominio";

// Dominio verificado no Resend (registros DKIM, SPF e DMARC no Registro.br).
// O onboarding@resend.dev de antes so entregava ao dono da conta Resend.
const REMETENTE = `Astro <nao-responda@${DOMINIO}>`;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Se o e-mail sai de verdade. Sem RESEND_API_KEY ele so vai para o log, e as
// telas nao devem prometer ao cliente um e-mail que nao chega.
export function emailConfigurado() {
  return resend !== null;
}

// RF08, RF09, RN13 — e-mail e disparado em todos os casos. Sem
// RESEND_API_KEY configurada, registra em log (modo dev/sem conta ainda).
//
// `html` e a versao bonita (modelo-email.ts); o `corpo` em texto puro vai
// junto, para quem le em programa sem HTML ou bloqueia imagens.
export async function enviarEmail(destinatario: string, assunto: string, corpo: string, html?: string) {
  if (!resend) {
    console.log(`[email:LOG] Para: ${destinatario} | Assunto: ${assunto}\n${corpo}`);
    return { enviado: true, modo: "log" as const };
  }

  const { error } = await resend.emails.send({
    from: REMETENTE,
    to: destinatario,
    subject: assunto,
    text: corpo,
    ...(html ? { html } : {}),
  });

  if (error) {
    console.error("[email:ERRO]", error);
    return { enviado: false, modo: "resend" as const, erro: error.message };
  }
  return { enviado: true, modo: "resend" as const };
}
