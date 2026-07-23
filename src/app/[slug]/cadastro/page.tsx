import { Suspense } from "react";
import { AuthForm } from "../login/auth-form";

// Tela 03 — Cadastro. Rota propria (nao um toggle), fiel ao mockup.
export default function CadastroPage() {
  return (
    <Suspense>
      <AuthForm modo="cadastro" />
    </Suspense>
  );
}
