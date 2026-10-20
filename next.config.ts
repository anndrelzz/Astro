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

  // Cabecalhos de seguranca enviados em toda resposta (paginas, API e
  // arquivos de public/).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nenhum outro site pode exibir o Astro dentro de um iframe. Sem isso,
          // um site qualquer carregava o login da estetica numa moldura
          // invisivel e induzia o cliente a clicar nela (clickjacking).
          // A CSP aqui tem SO essa regra: nao restringe scripts nem estilos.
          // Uma CSP completa exige nonce nos scripts do Next e fica para outra
          // mudanca. X-Frame-Options repete a regra para navegadores antigos.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // O navegador respeita o tipo de arquivo informado pelo servidor em
          // vez de adivinhar pelo conteudo — um upload nao vira script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ao seguir um link para fora, o outro site recebe so o dominio do
          // Astro, nao o caminho (que tem o id do agendamento, por exemplo).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Recursos do navegador que o app nao usa ficam desligados. A area de
          // transferencia (copiar PIX e cor) continua liberada.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Depois do primeiro acesso por HTTPS, o navegador nao aceita mais
          // HTTP para este dominio por 2 anos. Em HTTP (desenvolvimento local)
          // o navegador ignora este cabecalho.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
