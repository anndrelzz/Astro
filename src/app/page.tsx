import { redirect } from "next/navigation";
import { Landing } from "./_landing/landing";

// Landing de vendas do Astro: apresenta a plataforma para donos de esteticas
// automotivas. As partes da pagina ficam em _landing/ (pasta privada: o "_"
// tira a pasta do roteamento, entao nada ali vira URL).
export default function Home() {
  // Atalho de desenvolvimento: com TENANT_PADRAO no .env, a raiz manda direto
  // para o login daquela estetica, para nao ter de digitar o slug a cada vez.
  // Sem a variavel — que e o caso em producao — a raiz e a landing.
  const tenantPadrao = process.env.TENANT_PADRAO;
  if (tenantPadrao) redirect(`/${tenantPadrao}/login`);

  return <Landing />;
}
