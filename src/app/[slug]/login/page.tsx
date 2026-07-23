import { Suspense } from "react";
import { AuthForm } from "./auth-form";

// Tela 02 — Login. AuthForm usa useSearchParams (callbackUrl), por isso o
// Suspense obrigatorio no App Router.
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm modo="login" />
    </Suspense>
  );
}
