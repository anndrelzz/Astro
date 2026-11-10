import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Secao } from "@/front/legal/documento-legal";

// Termos de uso do Astro, aceitos no cadastro de cliente e no autocadastro de
// estetica. Rota fixa: vence o /[slug], e "termos" esta na lista de enderecos
// proibidos para estetica (compartilhado/endereco-estetica.ts).

export const metadata: Metadata = {
  title: "Termos de uso · Astro",
};

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de uso">
      <Secao titulo="O que é o Astro">
        <p>
          O Astro (<strong>useastro.app.br</strong>) é uma plataforma de agendamento online para estéticas
          automotivas. A estética cadastra os serviços, os preços e os horários; o cliente agenda pelo endereço da
          estética e paga por PIX ou no local.
        </p>
        <p>
          O Astro fornece a ferramenta. O serviço no carro é prestado pela <strong>estética</strong>, que é quem
          responde por ele.
        </p>
      </Secao>

      <Secao titulo="Sua conta">
        <ul>
          <li>Os dados do cadastro precisam ser verdadeiros, e o e-mail precisa ser seu;</li>
          <li>a senha é pessoal: não a compartilhe. Se suspeitar de uso indevido, troque-a pelo Esqueci minha senha;</li>
          <li>cada conta vale para uma estética. Para agendar em outra estética, crie uma conta no endereço dela.</li>
        </ul>
      </Secao>

      <Secao titulo="Agendamentos e cancelamentos">
        <ul>
          <li>O horário só é oferecido se a estética tiver vaga; ao confirmar, ele fica reservado para você;</li>
          <li>
            o preço exibido é o do tipo do seu carro. A estética pode cobrar um acréscimo pela condição do veículo,
            até o limite que ela informa antes do agendamento; essa diferença é acertada no local;
          </li>
          <li>
            o cancelamento pelo site vale até o prazo definido por cada estética. Depois dele, fale direto com a
            estética.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Pagamentos">
        <p>
          O pagamento do serviço é feito diretamente à estética: por PIX, no aplicativo do seu banco, ou no
          local. O Astro não recebe esse dinheiro, não faz reembolsos e não guarda dados bancários. A confirmação
          do PIX é feita pela estética, depois que ela confere o recebimento.
        </p>
      </Secao>

      <Secao titulo="Para estéticas">
        <ul>
          <li>Quem cadastra a estética declara ter autorização para representá-la;</li>
          <li>
            a estética é responsável pelos serviços, preços, horários e pela chave PIX que publica, e pelo uso
            que faz dos dados dos próprios clientes;
          </li>
          <li>o endereço escolhido no cadastro não pode ser trocado depois;</li>
          <li>o plano do Astro é cobrado à parte, por PIX, fora do sistema.</li>
        </ul>
      </Secao>

      <Secao titulo="Uso proibido">
        <p>
          Não é permitido usar o Astro para criar contas falsas ou em massa, tentar acessar dados de outra pessoa
          ou de outra estética, nem atrapalhar o funcionamento do sistema. Contas usadas assim podem ser
          bloqueadas.
        </p>
      </Secao>

      <Secao titulo="Disponibilidade">
        <p>
          O Astro busca ficar sempre no ar, mas pode passar por manutenções e falhas. Os avisos por e-mail e
          Telegram são um apoio: o agendamento vale pelo que está registrado no sistema.
        </p>
      </Secao>

      <Secao titulo="Privacidade e mudanças">
        <p>
          O tratamento dos seus dados está na <Link href="/privacidade">Política de privacidade</Link>. Estes
          termos podem mudar quando o Astro mudar; a versão em vigor é sempre a desta página.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
