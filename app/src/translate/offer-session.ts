// Dono da oferta de tradução na sessão: só o primeiro painel que a mostra a reivindica (puro, sem RN).

/** Quem fica com a oferta: o dono atual, ou o novo painel se ninguém a reivindicou ainda. */
export function claimOfferOwner(current: number | null, id: number): number {
  return current ?? id;
}
