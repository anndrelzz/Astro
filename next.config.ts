import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Por padrao o Next.js so serve os recursos de desenvolvimento (HMR, mapas
  // de fonte) para a origem com que o servidor subiu - localhost. Isso protege
  // o codigo-fonte da maquina do dev de ser lido por um site malicioso aberto
  // no mesmo navegador. Sem liberar a rede local, abrir o app pelo IP no
  // celular carrega o HTML mas nao o JavaScript: a pagina nunca hidrata e
  // recarrega em loop (RNF10 - a interface precisa ser testada em dispositivo
  // movel real).
  // Vale apenas em desenvolvimento; em producao esta opcao e ignorada.
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
