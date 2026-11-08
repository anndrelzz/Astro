import type { Metadata } from "next";
import { CadastroEstetica } from "@/front/start/cadastro-estetica";

// Autocadastro da estetica (decisao do orientador, 30/10). Rota fixa na raiz
// do site: o Next.js da preferencia a ela sobre o /[slug], e "start" esta nos
// enderecos proibidos (compartilhado/endereco-estetica.ts) para nenhuma
// estetica tentar usar.
export const metadata: Metadata = {
  title: "Cadastre sua estética · Astro",
  description: "Crie o site de agendamento da sua estética automotiva em poucos minutos.",
};

export default function StartPage() {
  return <CadastroEstetica />;
}
