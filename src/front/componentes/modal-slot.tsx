"use client";

import { AnimatePresence } from "framer-motion";

// Envolve o slot @modal (rotas interceptadas). Sem isto, o React desmontava
// o ModalRota na hora em que a navegacao fechava o pop-up, sem dar tempo da
// transicao de saida (definida nos motion.div de dentro) rodar.
export function ModalSlot({ children }: { children: React.ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}
