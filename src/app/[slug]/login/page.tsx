import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuthForm } from "./auth-form";

// Tela 02 — Login. E a porta de entrada da estetica: /[slug] manda para ca
// quem ainda nao esta autenticado (RF03), entao o nome e o logo precisam
// aparecer aqui para o visitante confirmar que abriu o link certo (RF14).
//
// AuthForm usa useSearchParams (callbackUrl), por isso o Suspense obrigatorio.
export default async function LoginPage({
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
      <AuthForm modo="login" estetica={tenant} />
    </Suspense>
  );
}
