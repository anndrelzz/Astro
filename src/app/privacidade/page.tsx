import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Secao } from "@/front/legal/documento-legal";

// LGPD (RNF08) — o que o Astro faz com os dados de quem usa. Rota fixa: vence
// o /[slug], e "privacidade" esta na lista de enderecos proibidos para
// estetica (compartilhado/endereco-estetica.ts).

export const metadata: Metadata = {
  title: "Política de privacidade · Astro",
};

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de privacidade">
      <Secao titulo="Quem somos">
        <p>
          O Astro (<strong>useastro.app.br</strong>) é uma plataforma de agendamento online para estéticas
          automotivas. Cada estética tem o próprio endereço no Astro, onde os clientes dela agendam e pagam os
          serviços.
        </p>
        <p>
          Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD), a <strong>estética</strong> é a
          controladora dos dados dos seus clientes: é ela quem decide usá-los para atender e agendar. O{" "}
          <strong>Astro</strong> é o operador: guarda e processa esses dados em nome da estética, só para que o
          agendamento funcione.
        </p>
      </Secao>

      <Secao titulo="Quais dados coletamos">
        <p>
          <strong>De quem agenda (cliente da estética):</strong>
        </p>
        <ul>
          <li>Nome, e-mail e telefone, informados no cadastro;</li>
          <li>a senha, guardada apenas de forma cifrada (hash bcrypt); ninguém, nem a estética, consegue lê-la;</li>
          <li>os dados dos carros: marca, modelo, placa, ano e cor;</li>
          <li>os agendamentos: serviço, data, horário, valor, forma de pagamento e situação;</li>
          <li>o identificador do Telegram, só se o cliente escolher vincular a conta ao bot do Astro.</li>
        </ul>
        <p>
          <strong>De quem administra uma estética:</strong> nome, e-mail, WhatsApp, os dados da estética (nome,
          endereço, contato, logo) e a chave PIX que ela quer mostrar aos clientes.
        </p>
        <p>
          <strong>Dados técnicos:</strong> para evitar cadastros em massa por robôs, guardamos um resumo
          criptográfico da conexão usada no cadastro, que não permite descobrir o endereço IP. Os registros de erro
          do servidor guardam a rota e a hora do problema, sem nome, e-mail ou placa.
        </p>
      </Secao>

      <Secao titulo="Para que usamos">
        <ul>
          <li>Criar a conta e permitir o acesso com segurança;</li>
          <li>mostrar os serviços com o preço do tipo de carro do cliente e registrar os agendamentos;</li>
          <li>
            enviar a confirmação, os lembretes de 24 horas e de 2 horas e os avisos de cancelamento e de
            pagamento, por e-mail (só para endereço confirmado) e pelo Telegram (só se vinculado);
          </li>
          <li>permitir que a estética organize a agenda, os clientes e o financeiro;</li>
          <li>manter o sistema seguro e funcionando, investigando erros.</li>
        </ul>
        <p>
          Não vendemos dados, não usamos os dados para propaganda e não mostramos os dados de um cliente a outra
          estética: cada estética só enxerga os próprios clientes, por uma regra aplicada no próprio banco de
          dados.
        </p>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>Só com os serviços necessários para o Astro funcionar:</p>
        <ul>
          <li>
            <strong>Microsoft Azure</strong> (região Brasil, São Paulo): onde o site e o banco de dados ficam
            hospedados;
          </li>
          <li>
            <strong>Resend</strong>: envia os e-mails de confirmação, lembrete e recuperação de senha;
          </li>
          <li>
            <strong>Telegram</strong>: envia os avisos pelo bot, só para quem vinculou a conta;
          </li>
          <li>
            <strong>Grafana Cloud</strong>: recebe os registros de erro e de desempenho do servidor, já sem e-mails
            e sem os códigos dos links.
          </li>
        </ul>
        <p>
          O pagamento por PIX é feito pelo cliente direto no aplicativo do banco dele: o Astro só mostra a chave
          da estética e não recebe nem guarda dados bancários.
        </p>
      </Secao>

      <Secao titulo="Cookies">
        <p>
          O Astro usa apenas os cookies necessários para funcionar: o da sessão, que mantém o login, e o da
          hospedagem, que direciona as visitas para o mesmo servidor. Não usamos cookies de propaganda nem de
          rastreamento.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Os dados ficam guardados enquanto a conta existir na estética. Os agendamentos ficam no histórico do
          cliente e no financeiro da estética. Os registros de erro do servidor são apagados automaticamente em
          cerca de 14 dias.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>Pelo art. 18 da LGPD, você pode, a qualquer momento:</p>
        <ul>
          <li>Confirmar se tratamos dados seus e ter acesso a eles;</li>
          <li>Corrigir dados incompletos ou desatualizados (nome e telefone podem ser editados no Perfil);</li>
          <li>pedir a eliminação dos seus dados e o encerramento da conta;</li>
          <li>saber com quem os dados são compartilhados;</li>
          <li>
            revogar o consentimento. Por exemplo, para não receber mais os avisos pelo Telegram, basta bloquear o
            bot do Astro no próprio Telegram.
          </li>
        </ul>
        <p>
          Para os pedidos que não estão no próprio sistema, fale com a estética em que você tem conta, pelo
          WhatsApp ou contato que aparece no site dela. Como controladora, ela encaminha o pedido ao Astro.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          O site só funciona por conexão segura (HTTPS), as senhas ficam cifradas, o acesso tem limite de
          tentativas e os dados de cada estética ficam isolados no banco. Os detalhes técnicos estão na
          documentação pública do projeto.
        </p>
      </Secao>

      <Secao titulo="Mudanças nesta política">
        <p>
          Esta política pode mudar quando o Astro mudar. A versão em vigor é sempre a desta página. Veja também
          os <Link href="/termos">Termos de uso</Link>.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
