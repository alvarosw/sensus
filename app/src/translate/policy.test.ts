import { describe, expect, it } from 'vitest';
import {
  batchFromKey,
  batchKey,
  batchPhase,
  batchTexts,
  globalAskList,
  isActive,
  isEligible,
  isOfferShown,
  noteCounts,
  preferPt,
  timelineNoteKind,
} from './policy';

const ON = { supported: true, loaded: true, enabled: true, model: 'ready', translatable: true };

describe('decisão de traduzir', () => {
  it('exige aparelho compatível, fonte em inglês e pelo menos um texto', () => {
    expect(isEligible({ supported: true, translatable: true, texts: 1 })).toBe(true);
    expect(isEligible({ supported: true, translatable: true, texts: 0 })).toBe(false);
    expect(isEligible({ supported: true, translatable: false, texts: 3 })).toBe(false);
    expect(isEligible({ supported: false, translatable: true, texts: 3 })).toBe(false);
  });

  it('item: ligada, carregada e fonte em inglês basta (o modelo não entra)', () => {
    expect(isActive('item', ON)).toBe(true);
    expect(isActive('item', { ...ON, model: 'missing' })).toBe(true);
    expect(isActive('item', { ...ON, enabled: false })).toBe(false);
    expect(isActive('item', { ...ON, translatable: false })).toBe(false);
    expect(isActive('item', { ...ON, loaded: false })).toBe(false);
  });

  it('global: além disso, o modelo precisa estar pronto', () => {
    expect(isActive('global', ON)).toBe(true);
    expect(isActive('global', { ...ON, model: 'downloading' })).toBe(false);
    expect(isActive('global', { ...ON, translatable: false })).toBe(false);
  });
});

describe('oferta da primeira vez', () => {
  const base = { eligible: true, loaded: true, enabled: false, offerAnswered: false, owner: null, panelId: 7 };

  it('aparece no item quando ainda não há dono e a opção está desligada', () => {
    expect(isOfferShown('item', base)).toBe(true);
  });

  it('só o dono a mostra: os demais painéis não repetem', () => {
    expect(isOfferShown('item', { ...base, owner: 3 })).toBe(false);
    expect(isOfferShown('item', { ...base, owner: 7 })).toBe(true);
  });

  it('nunca aparece no global (linha do tempo) nem depois de respondida ou ligada', () => {
    expect(isOfferShown('global', base)).toBe(false);
    expect(isOfferShown('item', { ...base, offerAnswered: true })).toBe(false);
    expect(isOfferShown('item', { ...base, enabled: true })).toBe(false);
    expect(isOfferShown('item', { ...base, eligible: false })).toBe(false);
  });
});

describe('lote de um bloco', () => {
  it('batchTexts tira vazios e textos só de espaços, sem mudar a ordem', () => {
    expect(batchTexts(['Paul', '', '   ', null, undefined, 'Saul'])).toEqual(['Paul', 'Saul']);
  });

  it('a chave ida e volta preserva a lista', () => {
    const list = ['Paul', 'Death of Saul'];
    expect(batchFromKey(batchKey(list))).toEqual(list);
    expect(batchFromKey('')).toEqual([]);
    expect(batchKey([])).toBe('');
  });

  it('fase: carregando enquanto falta tradução e o lote não voltou; falha quando voltou com erro', () => {
    expect(batchPhase({ active: true, allCached: false, result: 'pending' })).toEqual({ loading: true, failed: false });
    expect(batchPhase({ active: true, allCached: false, result: 'error' })).toEqual({ loading: false, failed: true });
    expect(batchPhase({ active: true, allCached: true, result: 'pending' })).toEqual({ loading: false, failed: false });
    expect(batchPhase({ active: false, allCached: false, result: 'pending' })).toEqual({ loading: false, failed: false });
  });
});

describe('lote global (linha do tempo)', () => {
  const has = (cached: string[], failed: string[] = []) => ({
    cached: (t: string) => cached.includes(t),
    failed: (t: string) => failed.includes(t),
  });

  it('pede só o que não está no cache, não falhou e não é vazio', () => {
    expect(globalAskList(['Paul', 'Saul', '', 'Ruth'], has(['Saul'], ['Ruth']))).toEqual(['Paul']);
  });

  it('nada a pedir quando tudo está no cache', () => {
    expect(globalAskList(['Paul'], has(['Paul']))).toEqual([]);
  });
});

describe('nome pt da linha do tempo', () => {
  it('com a tradução ativa, o pt aparece e "Ver original" volta ao inglês', () => {
    expect(preferPt(true, false)).toBe(true);
    expect(preferPt(true, true)).toBe(false);
  });

  it('com a tradução inativa, o pt aparece mesmo depois de "Ver original" (sem o botão, o nome não fica preso)', () => {
    expect(preferPt(false, false)).toBe(true);
    expect(preferPt(false, true)).toBe(true);
  });
});

describe('nota da linha do tempo: o que a tela de fato traduziu', () => {
  it('contagem: nome pt (NT, Paulo) conta como pt; nome sem pt (AT, Aaron) conta como traduzido só com cache', () => {
    expect(noteCounts([{ text: 'Paulo', pt: true }], () => true)).toEqual({ pt: 1, cached: 0 });
    expect(noteCounts([{ text: 'Aaron', pt: false }], (t) => t === 'Aaron')).toEqual({ pt: 0, cached: 1 });
    expect(noteCounts([{ text: 'Aaron', pt: false }], () => false)).toEqual({ pt: 0, cached: 0 });
    expect(noteCounts([{ text: '  ', pt: false }], () => true)).toEqual({ pt: 0, cached: 0 });
  });

  it('só texto pt do banco, com a tradução ativa e nada traduzido: sem aviso de tradução, só "Ver original"', () => {
    expect(timelineNoteKind({ active: true, showOriginal: false, pt: 3, cached: 0 })).toBe('pt');
  });

  it('algo traduzido pelo modelo sem pt na tela: aviso total; com pt também na tela: aviso parcial', () => {
    expect(timelineNoteKind({ active: true, showOriginal: false, pt: 0, cached: 2 })).toBe('machine');
    expect(timelineNoteKind({ active: true, showOriginal: false, pt: 1, cached: 2 })).toBe('partial');
  });

  it('tradução inativa, ou nada a dizer: nenhuma nota', () => {
    expect(timelineNoteKind({ active: false, showOriginal: false, pt: 3, cached: 2 })).toBe('none');
    expect(timelineNoteKind({ active: true, showOriginal: false, pt: 0, cached: 0 })).toBe('none');
  });

  it('"Ver original" ligado: volta à tradução só quando há pt ou tradução para voltar; senão, nada', () => {
    expect(timelineNoteKind({ active: true, showOriginal: true, pt: 1, cached: 0 })).toBe('original');
    expect(timelineNoteKind({ active: true, showOriginal: true, pt: 0, cached: 2 })).toBe('original');
    expect(timelineNoteKind({ active: true, showOriginal: true, pt: 0, cached: 0 })).toBe('none');
  });
});
