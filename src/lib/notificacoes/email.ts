import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// RF08, RF09, RN13 — e-mail e disparado em todos os casos. Sem
// RESEND_API_KEY configurada, registra em log (modo dev/sem conta ainda).
export async function enviarEmail(destinatario: string, assunto: string, corpo: string) {
  if (!resend) {
    console.log(`[email:LOG] Para: ${destinatario} | Assunto: ${assunto}\n${corpo}`);
    return { enviado: true, modo: "log" as const };
  }

  const { error } = await resend.emails.send({
    from: "Astro <onboarding@resend.dev>",
    to: destinatario,
    subject: assunto,
    text: corpo,
  });

  if (error) {
    console.error("[email:ERRO]", error);
    return { enviado: false, modo: "resend" as const, erro: error.message };
  }
  return { enviado: true, modo: "resend" as const };
}
