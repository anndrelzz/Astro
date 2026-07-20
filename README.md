<p align="center">
  <img src="logo.png" width="320" alt="Astro Logo">
</p>

# ASTRO — Plataforma SaaS de Gestão para Estéticas Automotivas

> Sistema multi-tenant com agendamento online, pagamento via PIX (Copia e Cola) e notificações automáticas por e-mail e Telegram.

---

## Sobre o Projeto

O **Astro** é uma plataforma SaaS desenvolvida para digitalizar a gestão de estéticas automotivas. O agendamento de serviços nesse segmento ainda é feito predominantemente via WhatsApp, ligações telefônicas ou anotações em cadernos físicos — resultando em conflitos de horário, perda de clientes e falta de controle financeiro.

O Astro resolve esse problema oferecendo uma plataforma completa onde cada estética possui sua própria URL personalizada, identidade visual configurável e um sistema de agendamento autônomo que o cliente consegue usar sem depender do atendente.

---

## Público-Alvo

| Perfil | Descrição |
|---|---|
| **Dono da Estética (Admin)** | Empreendedor com pouco tempo para administração. Acessa o painel para configurar serviços, horários, visualizar financeiro e personalizar a identidade visual. Nível técnico básico a intermediário. |
| **Cliente Final** | Proprietário de veículo que acessa o site público da estética para visualizar serviços, preços e realizar agendamentos. Principal canal de acesso: smartphone. |
| **Desenvolvedor SaaS** | Responsável pela manutenção e evolução da plataforma. Acesso total à infraestrutura, banco de dados e deploys. Provisiona novas estéticas manualmente. |

---

## Funcionalidades Principais

- Provisionamento de estéticas com URL própria (`astro.app/[slug-da-estetica]`), slug único e imutável
- Agendamento online com seleção de segmento de veículo, serviço, data e horário
- Precificação automática por segmento de veículo (hatch, sedan, SUV, pickup, van) — sem intervenção manual
- Pagamento via **PIX Copia e Cola** configurado pelo Admin, com **confirmação manual no painel** após verificação no banco — ou pagamento no local como alternativa
- Notificações automáticas por **e-mail** (sempre) e **Telegram** (opcional, se o cliente vincular a conta)
- Lembretes automáticos 24h e 2h antes do horário agendado
- Painel administrativo com visão geral de agendamentos, dashboard financeiro e relatórios
- Personalização de identidade visual por estética (logo, cor primária)
- Histórico de agendamentos e veículos por cliente autenticado
- Janela de cancelamento configurável por tenant (ex: 2h, 4h, 24h, 48h)
- Isolamento total de dados entre estéticas via Row-Level Security (RLS) no PostgreSQL

---

## Fora do Escopo (v1.0)

Excluído conscientemente para viabilizar a entrega no prazo do TCC — não compromete o núcleo de valor (agendamento, pagamento, notificação):

- Gateway de pagamento automatizado (Mercado Pago, Stripe, webhook PIX, cartão de crédito)
- Integração com WhatsApp (exige API paga e aprovação prévia de templates)
- Aplicativo mobile nativo (iOS/Android)
- Marketplace público de estéticas
- Emissão de documentos fiscais (NF-e/NFS-e)
- Gestão de estoque e produtos
- Múltiplos funcionários por estética (login individual, comissões, agenda por profissional)
- Cobrança e assinatura automática dos tenants (billing do SaaS) — provisionamento é manual, feito pelo desenvolvedor
- Módulo de fidelidade e promoções
- Internacionalização (i18n)
- API pública para terceiros / integração com calendários externos

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | Next.js 16 + Tailwind CSS v4 | SSR, App Router e responsividade nativa |
| Backend | Next.js API Routes | Monorepo simplificado, deploy único na Azure |
| ORM | Prisma ORM | Type-safe, migrations e suporte a RLS no PostgreSQL |
| Banco de dados | PostgreSQL (Azure) | RLS para isolamento multi-tenant nativo |
| Autenticação | NextAuth.js + JWT | Integração nativa com Next.js e Prisma |
| Pagamento PIX | Chave estática (Copia e Cola) | Configurada pelo Admin nas settings — sem integração com provedor externo |
| E-mail | Resend | API simples, confiável e com bom free tier |
| Notificações | Telegram Bot API | API oficial gratuita, sem dependência de serviço pago |
| Hospedagem | Microsoft Azure | App Service + Azure DB for PostgreSQL |
| Validação | Zod | Type-safe, integra com Next.js e Prisma |
| Senha | bcrypt | Hash seguro, padrão de mercado |

---

## Arquitetura

Multi-tenant com **Row-Level Security (RLS)** no PostgreSQL. Cada estética cadastrada é um tenant isolado — nenhum dado de uma estética é acessível por outra, garantido em nível de banco (não depende da camada de aplicação).

```
Cliente / Admin (navegador)
        │  HTTPS
        ▼
Azure App Service
(Next.js — Frontend + API Routes + NextAuth/JWT)
        │
        ├──── Azure Database for PostgreSQL (RLS por tenant_id)
        │
        ├──── Resend (e-mails transacionais)
        │
        └──── Telegram Bot API (notificações, opcional por cliente)
```

---

## Modelo de Dados

O banco é composto por 6 tabelas centrais, organizadas em torno de `TENANT` (isolamento multi-tenant via RLS):

| Tabela | Responsabilidade |
|---|---|
| `tenant` | Estética cadastrada — slug, nome, logo, cor primária, chave PIX Copia e Cola, janela de cancelamento |
| `usuario` | Clientes e admins — inclui `telegram_chat_id` e `telegram_link_token` para vinculação de notificações |
| `veiculo` | Veículos do cliente — marca, modelo, placa, ano, cor, segmento |
| `servico` | Serviços do tenant com duração e preço por segmento (hatch, sedan, SUV, pickup, van) |
| `agendamento` | Núcleo transacional — liga usuário, veículo e serviço; registra status e forma de pagamento |
| `notificacao` | Log de envio (tipo, status, tentativas) — sem conteúdo da mensagem |

A coluna `tenant_id`, presente em todas as tabelas sensíveis, é o que viabiliza as políticas de RLS.

---

## Fluxo de Agendamento

```
1. Cliente acessa a URL da estética (astro.app/[slug])
2. Sistema exige autenticação — login ou cadastro (nome, e-mail, telefone, senha)
3. Seleciona segmento do veículo — preços exibidos instantaneamente
4. Clica em "Agendar"
5. Sistema verifica veículo cadastrado — se não houver, exibe alerta e redireciona para cadastro
6. Seleciona data e horário disponível
7. Confirma o agendamento — horário bloqueado imediatamente
8. Redireciona para tela de pagamento
```

## Fluxo de Pagamento

```
1. Sistema exibe: PIX Copia e Cola (se configurado pelo Admin) ou pagamento no local
2. Se PIX: cliente copia a chave, paga no banco → status "PIX pendente"
3. Admin confirma manualmente no painel após verificar o recebimento
4. Se no local: agendamento confirmado com status pendente pagamento
5. Em ambos os casos: sistema envia e-mail de confirmação ao cliente
```

## Fluxo de Cancelamento

```
Cliente:
  Acessa "Meus Agendamentos" → seleciona agendamento → clica "Cancelar"
  Dentro da janela configurada pelo Admin → bloqueado, orienta contato direto
  Fora da janela → cancela, libera horário, notifica (e-mail + Telegram se vinculado)

Admin:
  Cancela qualquer agendamento sem restrição de janela
```

---

## Regras de Negócio Principais

- O preço do serviço é calculado automaticamente pelo segmento do veículo — não pode ser alterado manualmente
- Acesso a serviços e agendamento exige autenticação
- Cliente não pode agendar sem veículo cadastrado — sistema redireciona para o cadastro
- Horário é bloqueado imediatamente após confirmação, independente da forma de pagamento
- Capacidade simultânea de atendimentos é configurada por tenant
- Dados de um tenant nunca são acessíveis por outro (RLS)
- Dois lembretes automáticos por e-mail/Telegram: 24h e 2h antes do horário
- URL pública segue `astro.app/[slug-da-estetica]` — slug único e imutável
- Chave PIX exibida é a configurada pelo Admin; se ausente, opção PIX não aparece
- Antecedência mínima para cancelamento pelo cliente é configurável pelo Admin (ex: 2h, 4h, 24h, 48h)
- Vínculo com Telegram é opcional, via link único temporário (`t.me/AstroBot?start=TOKEN`); notificações continuam por e-mail se não vinculado

---

## KPIs

| Indicador | Meta |
|---|---|
| Tempo de carregamento de páginas | < 2 segundos em conexão 4G |
| Consulta de slots disponíveis | < 300ms |
| Isolamento entre tenants | 0 vazamentos em 100% dos testes de isolamento |
| Disponibilidade | Uptime mínimo de 99,5% |
| Tenants simultâneos | Mínimo de 100 estéticas ativas sem degradação |
| Confirmação de pagamento PIX | Confirmação manual pelo Admin após verificação no banco |

---

## Planejamento (Marcos)

| Marco | Entregas |
|---|---|
| M1 — Fundação | Setup do repositório, Azure, banco com RLS, NextAuth + JWT, estrutura multi-tenant, roteamento por slug |
| M2 — Núcleo do Agendamento | Cadastro de serviços por segmento, grade de horários, motor de slots, cadastro de veículos, fluxo de agendamento |
| M3 — Pagamento e Notificações | Tela PIX Copia e Cola, confirmação manual pelo Admin, integração Resend, integração Telegram Bot API, fila de notificações |
| M4 — Painel Admin e UX | Dashboard financeiro, relatórios, identidade visual, janela de cancelamento, fluxo de cancelamento completo |
| M5 — Qualidade e Segurança | Testes de isolamento RLS, testes de carga, auditoria OWASP, performance |
| M6 — Estabilização | Correção de bugs, documentação final, deploy de produção |

---

## Informações Acadêmicas

| | |
|---|---|
| **Curso** | Engenharia de Software |
| **Instituição** | Católica SC |
| **Autor** | André Luiz da Silva Estevão |
| **Orientador** | Diogo Vinícius Winck |
| **Ano** | 2026 |

---

*Astro — RFC v1.0 | Engenharia de Software | Católica SC | 2026*
