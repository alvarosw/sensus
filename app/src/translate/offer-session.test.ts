// A oferta de tradução aparece em um só painel por sessão: o primeiro painel a reivindica; os demais não a repetem.
import { describe, expect, it } from 'vitest';
import { claimOfferOwner } from './offer-session';

describe('oferta de tradução por sessão', () => {
  it('o primeiro painel que mostra a oferta a reivindica', () => {
    expect(claimOfferOwner(null, 1)).toBe(1);
  });

  it('reivindicar de novo não troca o dono (a oferta não passa para outro painel)', () => {
    expect(claimOfferOwner(1, 2)).toBe(1);
  });
});
