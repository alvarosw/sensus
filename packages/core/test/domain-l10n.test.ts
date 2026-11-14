import { describe, expect, it } from 'vitest';
import {
  TOKEN_GLOSS_LANG,
  contextGloss,
  glossShortText,
  headwordShortText,
  machineBatch,
  shortTextMark,
  shownShortText,
  topicHeadwordForTranslation,
  titleCaseHeadword,
} from '../src/index';

// Textos curtos: pacote -> tradução pronta -> original. Casos de NT grego (G0026, TAGNT) e de AT hebraico (H0430, TBESH).
describe('shownShortText', () => {
  it('NT G0026: pacote já no idioma do app vence a tradução', () => {
    const r = shownShortText({ packValue: { lang: 'pt', value: 'amor' }, original: 'love', machine: 'amor x', appLang: 'pt' });
    expect(r).toEqual({ text: 'amor', via: 'pack', lang: 'pt' });
  });

  it('NT G0026: sem pacote, a tradução pronta', () => {
    const r = shownShortText({ packValue: null, original: 'love', machine: 'amor', appLang: 'pt' });
    expect(r).toEqual({ text: 'amor', via: 'machine', lang: 'pt' });
  });

  it('AT H0430: sem pacote e sem tradução, o original com a língua dele', () => {
    const r = shownShortText({ packValue: null, original: 'God', machine: null, appLang: 'es' });
    expect(r).toEqual({ text: 'God', via: 'original', lang: 'en' });
  });

  it('AT H0430: tradução pronta vence o pacote em outra língua', () => {
    const r = shownShortText({ packValue: { lang: 'en', value: 'God' }, original: 'God', machine: 'Gott', appLang: 'de' });
    expect(r).toEqual({ text: 'Gott', via: 'machine', lang: 'de' });
  });

  it('AT H0430: pacote em outra língua e sem tradução mostra o pacote como original', () => {
    const r = shownShortText({ packValue: { lang: 'en', value: 'God' }, original: 'God', machine: null, appLang: 'de' });
    expect(r).toEqual({ text: 'God', via: 'original', lang: 'en' });
  });

  it('valores vazios ou só espaços são ausentes', () => {
    const r = shownShortText({ packValue: { lang: 'pt', value: '  ' }, original: 'love', machine: '', appLang: 'pt', originalLang: 'en' });
    expect(r).toEqual({ text: 'love', via: 'original', lang: 'en' });
  });

  it('base da língua: pt-BR conta como pt', () => {
    const r = shownShortText({ packValue: { lang: 'pt-BR', value: 'amor' }, original: 'love', machine: null, appLang: 'pt' });
    expect(r).toEqual({ text: 'amor', via: 'pack', lang: 'pt' });
  });
});

describe('shortTextMark', () => {
  it('marca só o original em outra língua', () => {
    expect(shortTextMark({ via: 'original', lang: 'en' }, 'pt')).toBe('en');
    expect(shortTextMark({ via: 'original', lang: 'en' }, 'en')).toBeNull();
    expect(shortTextMark({ via: 'machine', lang: 'pt' }, 'pt')).toBeNull();
    expect(shortTextMark({ via: 'pack', lang: 'pt' }, 'pt')).toBeNull();
  });
});

describe('títulos de tópico e de verbete', () => {
  it('inverte o tópico com palavra final pequena', () => {
    expect(topicHeadwordForTranslation('AFFLICTED, DUTY TOWARD THE')).toBe('Duty toward the Afflicted');
    expect(topicHeadwordForTranslation('HUMILITY, EXAMPLES OF')).toBe('Examples of Humility');
    expect(topicHeadwordForTranslation('IDOLATRY, WARNINGS AGAINST')).toBe('Warnings against Idolatry');
    expect(topicHeadwordForTranslation('GOD, LOVE OF')).toBe('Love of God');
    expect(topicHeadwordForTranslation('CHRIST, OFFICES OF')).toBe('Offices of Christ');
  });

  it('sem inversão, só a caixa de título', () => {
    expect(titleCaseHeadword('PHILIPPI')).toBe('Philippi');
    expect(topicHeadwordForTranslation('ASA')).toBe('Asa');
    expect(topicHeadwordForTranslation('JESUS, THE CHRIST')).toBe('Jesus, the Christ');
    expect(topicHeadwordForTranslation('EMPTY; EMPTIER')).toBe('Empty; Emptier');
  });

  it('headwordShortText: nome de entidade NT usa o pt e não vai ao modelo', () => {
    const r = headwordShortText('PHILIPPI', 'sword-isbe', [{ name: 'Philippi', namePt: 'Filipos' }], 'pt');
    expect(r.forMachine).toBeNull();
    expect(r.packValue).toEqual({ lang: 'pt', value: 'Filipos' });
  });

  it('headwordShortText: nome de entidade AT sem pt não vai ao modelo nem ganha pacote', () => {
    const r = headwordShortText('AARON', 'sword-isbe', [{ name: 'Aaron', namePt: null }], 'en');
    expect(r.forMachine).toBeNull();
    expect(r.packValue).toBeNull();
  });

  it('headwordShortText: tópico vai ao modelo com a frase invertida', () => {
    const r = headwordShortText('AFFLICTED, DUTY TOWARD THE', 'sword-nave', [], 'pt');
    expect(r).toEqual({
      original: 'Afflicted, Duty Toward the',
      lang: 'en',
      forMachine: 'Duty toward the Afflicted',
      packValue: null,
    });
  });

  it('headwordShortText: fonte desconhecida não traduz', () => {
    expect(headwordShortText('ASA', null, [], 'pt').forMachine).toBeNull();
  });
});

describe('glossShortText e contextGloss', () => {
  it('NT: glosa do léxico é traduzível, na língua da fonte', () => {
    const r = glossShortText({ lexicon: { gloss: 'love', source_id: 'stepbible-tbesg' }, tokenGloss: 'love' });
    expect(r).toEqual({ original: 'love', lang: 'en', forMachine: 'love', packValue: null });
  });

  it('NT com contexto em inglês usa a glosa do token; em outra língua, a do léxico', () => {
    const lexicon = { gloss: 'love', source_id: 'stepbible-tbesg' };
    expect(glossShortText({ lexicon, tokenGloss: 'loving', contextFor: 'en' })).toEqual({
      original: 'loving',
      lang: TOKEN_GLOSS_LANG,
      forMachine: null,
      packValue: null,
    });
    expect(glossShortText({ lexicon, tokenGloss: 'loving', contextFor: 'pt' })).toEqual({
      original: 'love',
      lang: 'en',
      forMachine: 'love',
      packValue: null,
    });
  });

  it('AT sem léxico: a glosa contextual do token, sem tradução', () => {
    expect(glossShortText({ lexicon: null, tokenGloss: '<the> God' })).toEqual({
      original: '<the> God',
      lang: 'en',
      forMachine: null,
      packValue: null,
    });
  });

  it('glosa do léxico vazia cai na do token; tudo vazio é null', () => {
    expect(glossShortText({ lexicon: { gloss: '', source_id: 'stepbible-tbesh' }, tokenGloss: 'God' })).toEqual({
      original: 'God',
      lang: TOKEN_GLOSS_LANG,
      forMachine: null,
      packValue: null,
    });
    expect(glossShortText({ lexicon: null, tokenGloss: '  ' })).toBeNull();
  });

  it('contextGloss: só o token, e só em inglês ou sem glosa do léxico', () => {
    expect(contextGloss({ tokenGloss: 'love', lexiconGloss: 'love', appLang: 'en' })?.original).toBe('love');
    expect(contextGloss({ tokenGloss: 'love', lexiconGloss: 'love', appLang: 'pt' })).toBeNull();
    expect(contextGloss({ tokenGloss: 'God', lexiconGloss: null, appLang: 'pt' })?.original).toBe('God');
  });
});

describe('machineBatch', () => {
  it('um lote por língua de origem, sem repetir, na ordem', () => {
    const items = [
      glossShortText({ lexicon: { gloss: 'love', source_id: 'stepbible-tbesg' }, tokenGloss: 'love' }),
      glossShortText({ lexicon: null, tokenGloss: 'loving' }),
      headwordShortText('AFFLICTED, DUTY TOWARD THE', 'sword-nave', [], 'pt'),
      { original: 'amor', lang: 'es', forMachine: 'amor', packValue: null },
      glossShortText({ lexicon: { gloss: 'love', source_id: 'stepbible-tbesg' }, tokenGloss: 'love' }),
    ];
    expect(machineBatch(items)).toEqual({ lang: 'en', texts: ['love', 'Duty toward the Afflicted'] });
  });

  it('sem nada traduzível', () => {
    expect(machineBatch([])).toEqual({ lang: null, texts: [] });
    expect(machineBatch([null, glossShortText({ lexicon: null, tokenGloss: 'God' })])).toEqual({ lang: null, texts: [] });
  });
});
