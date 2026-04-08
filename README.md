<p align="center">
  <img src="Astro.svg" width="180" alt="Astro Logo">
</p>

# ASTRO — Plataforma SaaS de Gestão para Estéticas Automotivas

> Sistema multi-tenant com agendamento online, pagamento via PIX e notificações automáticas.

---

## Sobre o Projeto

O **Astro** é uma plataforma SaaS desenvolvida para digitalizar a gestão de estéticas automotivas. O agendamento de serviços nesse segmento ainda é feito predominantemente via WhatsApp, ligações telefônicas ou anotações em cadernos físicos — resultando em conflitos de horário, perda de clientes e falta de controle financeiro.

O Astro resolve esse problema oferecendo uma plataforma completa onde cada estética possui sua própria URL personalizada, identidade visual configurável e um sistema de agendamento autônomo que o cliente consegue usar sem depender do atendente.

---

## Público-Alvo

| Perfil | Descrição |
|---|---|
| **Dono da Estética (Admin)** | Empreendedor com pouco tempo para administração. Acessa o painel para configurar serviços, horários, visualizar financeiro e personalizar a identidade visual. |
| **Cliente Final** | Proprietário de veículo que acessa o site público da estética para visualizar serviços, preços e realizar agendamentos. Principal canal de acesso: smartphone. |
| **Desenvolvedor SaaS** | Responsável pela manutenção e evolução da plataforma. Acesso total à infraestrutura, banco de dados e deploys. |

---

## Funcionalidades Principais

- Cadastro de estéticas com URL personalizada (`astro.com.br/nome-da-estetica`)
- Agendamento online com seleção de veículo, serviço, data e horário
- Precificação automática por segmento de veículo (hatch, sedan, SUV, pickup, van)
- Pagamento via PIX com QR Code dinâmico e confirmação automática via webhook
- Notificações automáticas por e-mail e WhatsApp (confirmação, lembrete 24h, cancelamento)
- Painel administrativo com dashboard financeiro e relatórios exportáveis
- Personalização de identidade visual por estética (logo, cores)
- Histórico de agendamentos e avaliações pós-serviço
- Isolamento total de dados entre estéticas via Row-Level Security (RLS)

---

## Stack Tecnológica

<p align="center">
  <img src="https://skillicons.dev/icons?i=nextjs,ts,postgres,prisma,tailwind" /><br/>
  <img src="https://skillicons.dev/icons?i=vitest,playwright,azure,githubactions" /><br/>
  <a href="https://zod.dev"><img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod"/></a>
  <a href="https://resend.com"><img src="https://img.shields.io/badge/Resend-000000?style=for-the-badge&logo=resend&logoColor=white" alt="Resend"/></a>
  <a href="https://sonarcloud.io"><img src="https://img.shields.io/badge/SonarCloud-F3702A?style=for-the-badge&logo=sonarcloud&logoColor=white" alt="SonarCloud"/></a>
  <a href="https://www.mercadopago.com.br"><img src="https://img.shields.io/badge/Mercado%20Pago-00B1EA?style=for-the-badge&logo=mercadopago&logoColor=white" alt="Mercado Pago"/></a>
</p>

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 14 (App Router + SSR) |
| Linguagem | TypeScript |
| Banco de Dados | PostgreSQL + RLS (multi-tenancy) |
| ORM | Prisma |
| Estilização | Tailwind CSS |
| Autenticação | JWT + bcrypt |
| Pagamentos | Mercado Pago / Efipay (PIX) |
| E-mail | Resend |
| WhatsApp | Z-API / Evolution API |
| Validação | Zod |
| Testes | Vitest (unitários) + Playwright (E2E) |
| Qualidade de Código | SonarCloud |
| Monitoramento | Azure Monitor |
| CI/CD | GitHub Actions |
| Hospedagem | Azure App Service + Azure Database for PostgreSQL + Azure Blob Storage |

---

## Arquitetura

O sistema utiliza arquitetura **multi-tenant com Row-Level Security (RLS)** no PostgreSQL. Cada estética cadastrada é um tenant isolado — nenhum dado de uma estética é acessível por outra.

```
Internet
    │
    ▼
Azure App Service
(Next.js — Frontend + API)
    │
    ├──── Azure Database for PostgreSQL (RLS)
    │         clientes, agendamentos, veículos, serviços...
    │
    └──── Azure Blob Storage
              logos e imagens das estéticas
```

---

## Modelo de Dados

O banco é composto por 13 tabelas, todas com `tenant_id` para isolamento via RLS:

| Tabela | Responsabilidade |
|---|---|
| `tenants` | Estéticas cadastradas — slug, nome, capacidade, tema |
| `admins` | Donos das estéticas com credenciais |
| `clientes` | Clientes de cada estética com dados pessoais e LGPD |
| `veiculos` | Veículos com marca, modelo, placa, cor e segmento |
| `servicos` | Serviços com título, descrição e duração |
| `servico_precos` | Tabela de preço por segmento de veículo |
| `horarios_funcionamento` | Grade semanal de atendimento por tenant |
| `bloqueios_agenda` | Períodos bloqueados (feriados, férias) |
| `agendamentos` | Núcleo do sistema — liga cliente, veículo e serviço |
| `pagamentos` | Registros PIX (QR code, txid) e presencial |
| `avaliacoes` | Nota (1-5) e comentário pós-serviço |
| `notificacoes_log` | Log de notificações por canal e status |
| `audit_log` | Ações críticas com dados anteriores em JSONB |

---

## Fluxo de Agendamento

```
1. Cliente acessa a URL da estética
2. Faz login ou cria conta (verificação de e-mail)
3. Cadastra veículo (marca, modelo, placa, segmento)
4. Seleciona serviço — preço calculado automaticamente pelo segmento
5. Escolhe data no calendário (apenas dias com vagas disponíveis)
6. Seleciona horário disponível
7. Confirma e paga via PIX ou presencialmente
8. Recebe confirmação por WhatsApp
```

---

## Ciclo de Vida do Agendamento

| Status | Evento | Ação |
|---|---|---|
| `pendente` | Cliente confirma | Gera cobrança PIX ou aguarda pagamento presencial |
| `confirmado` | Webhook PIX recebido | Envia notificação ao cliente |
| `em_andamento` | Data/hora chegou | Admin inicia o serviço |
| `concluido` | Admin finaliza | Envia solicitação de avaliação |
| `cancelado` | Cliente (>2h) ou admin cancela | Notifica a outra parte; libera slot |

---

## Regras de Negócio

- O preço é **congelado** no momento da confirmação do agendamento
- Cliente só agenda após cadastrar ao menos um veículo
- Cancelamento pelo cliente exige mínimo de **2 horas** de antecedência
- QR Code PIX expira em **30 minutos**
- A placa do veículo é única **por tenant**
- Admin pode cancelar qualquer agendamento a qualquer momento

---

## KPIs

| Indicador | Meta |
|---|---|
| Tempo de carregamento de páginas | < 2 segundos em 4G |
| Consulta de slots disponíveis | < 300ms |
| Isolamento entre tenants | 0 vazamentos em 100% dos testes |
| Disponibilidade | Uptime ≥ 99,5% |
| Tenants simultâneos | 100+ estéticas sem degradação |
| Confirmação de pagamento PIX | < 10 segundos via webhook |

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
