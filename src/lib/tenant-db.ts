import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// RNF06 — RLS (migration 20260723_rls) filtra usuario, veiculo, servico,
// agendamento, horario_funcionamento e notificacao por
// current_setting('app.tenant_id'). withTenant abre uma transacao e seta
// essa GUC via SET LOCAL (escopo de transacao, reverte no commit/rollback
// e e seguro com o pool de conexoes do adapter pg). Toda leitura/escrita
// autenticada nessas tabelas deve passar por aqui — os filtros explicitos
// de tenantId no codigo continuam obrigatorios como segunda camada.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`,
      tenantId
    );
    return fn(tx);
  });
}

// Uso restrito ao webhook do Telegram (RN12/UC15): localizar o usuario
// dono de um telegramLinkToken sem conhecer o tenant de antemao. A policy
// RLS de "usuario" permite SELECT por esse token cruzando tenants (ver
// migration), nunca escrita. Depois de resolver o usuario/tenant, toda
// escrita deve continuar via withTenant(usuario.tenantId, ...).
export async function withTelegramTokenLookup<T>(
  token: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.telegram_lookup_token', $1, true)`,
      token
    );
    return fn(tx);
  });
}
