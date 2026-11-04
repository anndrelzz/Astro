import "server-only";
import type { Session } from "next-auth";
import { withTenant } from "@/back/tenant-db";

// Se o cliente tem algo para ver no Perfil, o que acende o ponto vermelho no
// item Perfil dos menus. Hoje e o e-mail ainda nao confirmado: sem ele, os
// avisos dos agendamentos nao saem por e-mail (ver back/confirmacao-email.ts).
// O Telegram fica de fora de proposito: ele e opcional.
export async function temAvisoNoPerfil(session: Session | null, tenantId: string | undefined) {
  if (!session || !tenantId || session.user.tenantId !== tenantId || session.user.role !== "CLIENTE") {
    return false;
  }
  const usuario = await withTenant(tenantId, (tx) =>
    tx.usuario.findUnique({ where: { id: session.user.id }, select: { emailConfirmadoEm: true } })
  );
  return !!usuario && usuario.emailConfirmadoEm === null;
}
