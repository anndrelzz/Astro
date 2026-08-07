import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuthForm } from "../login/auth-form";

// Tela 03 — Cadastro. Rota propria (nao um toggle), fiel ao mockup. Mostra a
// identidade da estetica pelo mesmo motivo do login (RF14).
export default async function CadastroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { nome: true, logoUrl: true },
  });
  if (!tenant) notFound();

  return (
    <Suspense>
      <AuthForm modo="cadastro" estetica={tenant} />
    </Suspense>
  );
}
