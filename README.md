# GEAR - SaaS de Gestão para Estéticas Automotivas

O GEAR é uma plataforma SaaS (Software as a Service) Multi-tenant projetada para modernizar e profissionalizar o gerenciamento de agendamentos em centros de estética automotiva. O sistema oferece uma solução completa B2B2C, permitindo que empresas cadastrem suas unidades e ofereçam portais exclusivos para seus clientes finais.

## Proposta do Projeto
Diferente de sistemas de agenda genéricos, o GEAR foca na precisão operacional. A plataforma resolve conflitos de horários e a falta de dados estruturados através de um fluxo de agendamento inteligente e travas de segurança obrigatórias.

### Principais Funcionalidades

* Multi-tenancy Dinâmico: Cada estética possui seu próprio subdomínio ou slug exclusivo (ex: estimacar.gear.app), com isolamento total de dados entre inquilinos.
* Agendamento Inteligente: Realiza o bloqueio automático de slots na agenda baseado na duração real de cada serviço, evitando sobreposição de horários.
* Customização de Identidade (Aba Aparência): Administradores podem realizar o upload da logo (Base64) e definir uma cor secundária dinâmica, mantendo a base visual profissional em tons de preto e cinza.
* Funil de Segurança: O agendamento é liberado apenas após a verificação de e-mail e o cadastro obrigatório de um veículo (modelo, categoria, placa e cor).
* Dashboard Administrativo: Visão consolidada de métricas de produtividade, faturamento e histórico de agendamentos.

## Stack Tecnológica

* Frontend: Next.js (React) com Tailwind CSS.
* Backend: Node.js com TypeScript via Next.js API Routes (Arquitetura Serverless).
* Banco de Dados: PostgreSQL com Prisma ORM (Persistência Relacional).
* Comunicação: Resend para e-mails transacionais de verificação e status.
* Infraestrutura: Deploy automatizado na Vercel com pipeline de CI/CD via GitHub Actions.

## Conformidade e Engenharia
O projeto foi desenvolvido sob as diretrizes do The Portfolio Playbook, atendendo aos seguintes critérios:
* LGPD Compliance: Implementação de direito ao esquecimento, consentimento explícito e transparência de dados.
* Qualidade de Software: Cobertura de testes automatizados (TDD), análise estática com SonarCloud e monitoramento de performance (NewRelic ou Datadog).
* Arquitetura: Separação clara de responsabilidades seguindo padrões de mercado para aplicações escaláveis.

---
Projeto desenvolvido como parte do Portfólio de Engenharia de Software - Católica SC.
