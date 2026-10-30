// O pacote server-only lanca erro quando e importado fora do servidor do Next
// (e o Next que o troca por um modulo vazio). Os testes do backend rodam no
// Node, sem o Next: o vitest.config.mts aponta o import para este arquivo.
export {};
