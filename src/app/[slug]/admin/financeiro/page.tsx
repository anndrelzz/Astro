import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { FinanceiroDashboard } from "./financeiro-dashboard";

// RF12, UC11 — dashboard financeiro do Admin.
export default async function AdminFinanceiroPage({
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
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <AdminNav slug={slug} />
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard financeiro
      </h1>
      <FinanceiroDashboard />
    </div>
  );
}
