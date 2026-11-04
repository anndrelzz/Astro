import { z } from "zod";
import { LIMITES } from "@/compartilhado/validacoes/limites";

// As tres regras aparecem no medidor de forca da tela 03. Servidor e tela
// precisam exigir exatamente o mesmo: prometer "1 maiuscula" e aceitar uma
// senha sem maiuscula transforma o medidor em enfeite. Vale para o cadastro e
// para a senha nova do "esqueci minha senha" (RFC 6.2).
export const senhaSchema = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .max(LIMITES.senha, `Senha deve ter no maximo ${LIMITES.senha} caracteres`)
  .refine((s) => /\d/.test(s), "Senha deve conter ao menos 1 numero")
  .refine((s) => /[A-Z]/.test(s), "Senha deve conter ao menos 1 letra maiuscula");
