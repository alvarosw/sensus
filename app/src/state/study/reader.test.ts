import { beforeEach, describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import { useStudy } from './index';

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

describe('leitor', () => {
  it('começa em BLivre, sem grego, sem referência fixada', () => {
    const s = useStudy.getState();
    expect(s).toMatchObject({ textSource: 'blivre', greek: false, pinned: null, jumpTarget: null });
  });

  it('toggleGreek alterna o grego sob os versículos', () => {
    useStudy.getState().toggleGreek();
    expect(useStudy.getState().greek).toBe(true);
    useStudy.getState().toggleGreek();
    expect(useStudy.getState().greek).toBe(false);
  });

  it('pin fixa e solta uma referência; jumpTo marca e zera o alvo', () => {
    const ref = { citeId: 'cite-9', start: makeVid(11, 15, 15), end: makeVid(11, 15, 16) };
    useStudy.getState().pin(ref);
    expect(useStudy.getState().pinned).toEqual(ref);
    useStudy.getState().pin(null);
    expect(useStudy.getState().pinned).toBeNull();

    useStudy.getState().jumpTo(ref.start);
    expect(useStudy.getState().jumpTarget).toBe(ref.start);
    useStudy.getState().jumpTo(null);
    expect(useStudy.getState().jumpTarget).toBeNull();
  });

  it('setTextSource grava só o espelho do leitor (a fonte da verdade é app-prefs)', () => {
    useStudy.getState().setTextSource('kjv');
    expect(useStudy.getState().textSource).toBe('kjv');
  });
});
