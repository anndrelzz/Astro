import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VincularTelegram } from "./vincular-telegram";

// UC15 — cliente acessa o perfil e vincula (opcionalmente) o Telegram.
export default async function PerfilPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Perfil
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {usuario?.nome} — {usuario?.email}
      </p>

      <div className="mt-6">
        <VincularTelegram jaVinculado={!!usuario?.telegramChatId} />
      </div>
    </div>
  );
}
