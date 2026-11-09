import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";

// Cliente "coringa" da estetica (ideia do orientador, 30/10): o Admin agenda
// por ele quem chamou no WhatsApp ou no Instagram, sem criar conta para essa
// pessoa. O nome e o telefone dela ficam no proprio agendamento.
//
// Um por estetica, achado pelo e-mail fixo (o par estetica + e-mail e unico).
// O dominio .interno nao existe na internet, entao nenhum e-mail sai para la,
// e a senha e aleatoria e descartada: ninguem entra com ele. As notificacoes
// dele sao puladas em registrarNotificacao.
export const EMAIL_DO_CORINGA = "coringa@astro.interno";

export async function obterCoringa(tx: Prisma.TransactionClient, tenantId: string) {
  const existente = await tx.usuario.findUnique({
    where: { tenantId_email: { tenantId, email: EMAIL_DO_CORINGA } },
  });
  if (existente) return existente;

  return tx.usuario.create({
    data: {
      tenantId,
      nome: "Agendado pelo Admin",
      email: EMAIL_DO_CORINGA,
      senhaHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      role: "CLIENTE",
      coringa: true,
    },
  });
}
