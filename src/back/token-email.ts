import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Token dos links enviados por e-mail (redefinir a senha, confirmar o
// e-mail). O token vai no link; no banco fica so o sha256 dele, para quem ler
// o banco nao conseguir usar os links abertos. 32 bytes aleatorios nao se
// adivinham, entao o hash nao precisa de sal.
export function gerarTokenEmail() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashDoToken(token) };
}

export function hashDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
