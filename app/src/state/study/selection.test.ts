import { beforeEach, describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import { useStudy } from './index';

// Fp 2:5-8 (NT) e 1Rs 15:15 (AT): a seleção não depende de testamento, mas o caso de cada um fica coberto.
const FP_2_5 = makeVid(50, 2, 5);
const FP_2_6 = makeVid(50, 2, 6);
const FP_2_8 = makeVid(50, 2, 8);
const KINGS_15_15 = makeVid(11, 15, 15);
const KINGS_15_16 = makeVid(11, 15, 16);

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

describe('seleção: setSelection', () => {
  it('ordena o intervalo e usa o início como âncora por padrão', () => {
    useStudy.getState().setSelection(FP_2_8, FP_2_5);
    expect(useStudy.getState().selection).toEqual({ start: FP_2_5, end: FP_2_8, anchor: FP_2_5 });
  });

  it('guarda a âncora dada (1Rs 15:15-16)', () => {
    useStudy.getState().setSelection(KINGS_15_15, KINGS_15_16, KINGS_15_16);
    expect(useStudy.getState().selection).toEqual({ start: KINGS_15_15, end: KINGS_15_16, anchor: KINGS_15_16 });
  });

  it('abre a folha em peek quando estava fechada, e não mexe numa folha já aberta', () => {
    useStudy.getState().setSelection(FP_2_5, FP_2_5);
    expect(useStudy.getState().detent).toBe('peek');
    useStudy.setState({ detent: 'full' });
    useStudy.getState().setSelection(FP_2_5, FP_2_6);
    expect(useStudy.getState().detent).toBe('full');
  });
});

describe('seleção: tapVerse', () => {
  it('sem seleção: seleciona o versículo e abre em peek', () => {
    useStudy.getState().tapVerse(FP_2_5);
    const s = useStudy.getState();
    expect(s.selection).toEqual({ start: FP_2_5, end: FP_2_5, anchor: FP_2_5 });
    expect(s.previousSelection).toBeNull();
    expect(s.detent).toBe('peek');
  });

  it('sem seleção e folha já aberta: mantém a altura', () => {
    useStudy.setState({ detent: 'half' });
    useStudy.getState().tapVerse(KINGS_15_15);
    expect(useStudy.getState().detent).toBe('half');
  });

  it('fora do intervalo: estende a partir da âncora, para trás e para frente', () => {
    useStudy.getState().tapVerse(FP_2_6);
    useStudy.getState().tapVerse(FP_2_8);
    expect(useStudy.getState().selection).toEqual({ start: FP_2_6, end: FP_2_8, anchor: FP_2_6 });

    useStudy.getState().tapVerse(FP_2_5);
    expect(useStudy.getState().selection).toEqual({ start: FP_2_5, end: FP_2_6, anchor: FP_2_6 });
  });

  it('dentro de um intervalo com mais de um versículo: reduz ao toque e guarda a seleção anterior', () => {
    useStudy.getState().setSelection(FP_2_5, FP_2_8, FP_2_5);
    useStudy.getState().tapVerse(FP_2_6);
    const s = useStudy.getState();
    expect(s.selection).toEqual({ start: FP_2_6, end: FP_2_6, anchor: FP_2_6 });
    expect(s.previousSelection).toEqual({ start: FP_2_5, end: FP_2_8, anchor: FP_2_5 });
  });

  it('dentro de uma seleção de um versículo só: não faz nada', () => {
    useStudy.getState().tapVerse(KINGS_15_15);
    const before = useStudy.getState().selection;
    useStudy.getState().tapVerse(KINGS_15_15);
    expect(useStudy.getState().selection).toBe(before);
    expect(useStudy.getState().previousSelection).toBeNull();
  });
});

describe('seleção: undoSelection e clearSelection', () => {
  it('undoSelection volta à seleção anterior à redução', () => {
    useStudy.getState().setSelection(FP_2_5, FP_2_8, FP_2_5);
    useStudy.getState().tapVerse(FP_2_6);
    useStudy.getState().undoSelection();
    const s = useStudy.getState();
    expect(s.selection).toEqual({ start: FP_2_5, end: FP_2_8, anchor: FP_2_5 });
    expect(s.previousSelection).toBeNull();
  });

  it('undoSelection sem anterior não altera nada', () => {
    useStudy.getState().setSelection(FP_2_5, FP_2_6);
    const before = useStudy.getState().selection;
    useStudy.getState().undoSelection();
    expect(useStudy.getState().selection).toBe(before);
  });

  it('clearSelection limpa a seleção, fecha a folha e a prévia', () => {
    useStudy.getState().setSelection(FP_2_5, FP_2_6);
    useStudy.getState().openPopover('x');
    useStudy.getState().clearSelection();
    const s = useStudy.getState();
    expect(s.selection).toBeNull();
    expect(s.previousSelection).toBeNull();
    expect(s.detent).toBe('closed');
    expect(s.popoverCite).toBeNull();
  });
});
