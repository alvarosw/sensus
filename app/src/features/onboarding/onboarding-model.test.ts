import { describe, expect, it } from 'vitest';
import {
  advance,
  back,
  canSkip,
  ONBOARDING_DONE,
  progressOf,
  skip,
  stepsFor,
  type OnboardingContext,
} from './onboarding-model';

const WITH_DATA: OnboardingContext = { dataInstalled: true, hasBible: true };
const WITHOUT_DATA: OnboardingContext = { dataInstalled: false, hasBible: true };
const NO_BIBLE: OnboardingContext = { dataInstalled: false, hasBible: false };
const BIBLE_ONLY: OnboardingContext = { dataInstalled: false, hasBible: false, bibleOnly: true };

describe('passos', () => {
  it('sem dados completos, os sete passos na ordem', () => {
    expect(stepsFor(WITHOUT_DATA)).toEqual(['abertura', 'idioma', 'biblia', 'tradicoes', 'ia', 'dados', 'fim']);
  });

  it('com os dados completos instalados, o passo de dados some', () => {
    expect(stepsFor(WITH_DATA)).toEqual(['abertura', 'idioma', 'biblia', 'tradicoes', 'ia', 'fim']);
  });

  it('avançar percorre a lista e o último passo conclui', () => {
    expect(advance('abertura', WITHOUT_DATA)).toBe('idioma');
    expect(advance('ia', WITHOUT_DATA)).toBe('dados');
    expect(advance('dados', WITHOUT_DATA)).toBe('fim');
    expect(advance('fim', WITHOUT_DATA)).toBe(ONBOARDING_DONE);
  });

  it('avançar pula o passo de dados quando ele não existe', () => {
    expect(advance('ia', WITH_DATA)).toBe('fim');
  });

  it('avançar a partir de um passo que saiu da lista vai para o próximo visível', () => {
    // os dados ficaram instalados com o passo de dados aberto: segue para o fim
    expect(advance('dados', WITH_DATA)).toBe('fim');
  });

  it('voltar vai ao passo visível anterior e, no primeiro, fica nele', () => {
    expect(back('fim', WITHOUT_DATA)).toBe('dados');
    expect(back('fim', WITH_DATA)).toBe('ia');
    expect(back('idioma', WITHOUT_DATA)).toBe('abertura');
    expect(back('abertura', WITHOUT_DATA)).toBe('abertura');
  });

  it('pular conclui a apresentação', () => {
    expect(skip(WITHOUT_DATA)).toBe(ONBOARDING_DONE);
  });
});

describe('Bíblia obrigatória', () => {
  it('sem Bíblia baixada, o passo de Bíblia não avança; com ela, segue', () => {
    expect(advance('biblia', NO_BIBLE)).toBe('biblia');
    expect(advance('biblia', WITHOUT_DATA)).toBe('tradicoes');
    expect(advance('idioma', NO_BIBLE)).toBe('biblia');
  });

  it('pular sem Bíblia leva ao passo de Bíblia', () => {
    expect(skip(NO_BIBLE)).toBe('biblia');
  });

  it('o Pular some do passo de Bíblia enquanto não há nenhuma', () => {
    expect(canSkip('biblia', NO_BIBLE)).toBe(false);
    expect(canSkip('idioma', NO_BIBLE)).toBe(true);
    expect(canSkip('biblia', WITHOUT_DATA)).toBe(true);
    expect(canSkip('abertura', WITHOUT_DATA)).toBe(false);
  });

  it('modo só Bíblia: um passo, sem voltar, pular nem progresso; com a Bíblia baixada, conclui', () => {
    expect(stepsFor(BIBLE_ONLY)).toEqual(['biblia']);
    expect(back('biblia', BIBLE_ONLY)).toBe('biblia');
    expect(canSkip('biblia', { ...BIBLE_ONLY, hasBible: true })).toBe(false);
    expect(progressOf('biblia', BIBLE_ONLY)).toBeNull();
    expect(advance('biblia', BIBLE_ONLY)).toBe('biblia');
    expect(advance('biblia', { ...BIBLE_ONLY, hasBible: true })).toBe(ONBOARDING_DONE);
  });
});

describe('progresso', () => {
  it('conta só os passos do meio (sem abertura e fim)', () => {
    expect(progressOf('abertura', WITHOUT_DATA)).toBeNull();
    expect(progressOf('fim', WITHOUT_DATA)).toBeNull();
    expect(progressOf('idioma', WITHOUT_DATA)).toEqual({ index: 1, total: 5 });
    expect(progressOf('dados', WITHOUT_DATA)).toEqual({ index: 5, total: 5 });
  });

  it('sem o passo de dados, o total cai para quatro', () => {
    expect(progressOf('ia', WITH_DATA)).toEqual({ index: 4, total: 4 });
  });
});
