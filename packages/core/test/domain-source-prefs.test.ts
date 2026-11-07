import { describe, expect, it } from 'vitest';
import {
  ALL_COMMENTARIES,
  isCommentaryAllowed,
  parseCommentaryPreference,
  type CommentaryPreference,
} from '../src/index';

const ADV: CommentaryPreference = { traditions: ['adventist'], hiddenSources: [] };

describe('preferência de comentários (domínio)', () => {
  it('sem preferência, tudo passa, inclusive fonte sem tradição', () => {
    expect(isCommentaryAllowed('egw-steps', 'adventist', ALL_COMMENTARIES)).toBe(true);
    expect(isCommentaryAllowed('sword-wesley', null, ALL_COMMENTARIES)).toBe(true);
  });

  it('com tradições escolhidas, só essas passam (NT grego: reformada aceita, dispensacional não)', () => {
    const pref: CommentaryPreference = { traditions: ['reformed'], hiddenSources: [] };
    expect(isCommentaryAllowed('sword-calvincommentaries', 'reformed', pref)).toBe(true);
    expect(isCommentaryAllowed('sword-scofield', 'dispensational', pref)).toBe(false);
  });

  it('com tradições escolhidas, fonte sem tradição fica de fora (AT hebraico: comentário adventista)', () => {
    expect(isCommentaryAllowed('smith-daniel', 'adventist', ADV)).toBe(true);
    expect(isCommentaryAllowed('sword-kd', 'lutheran', ADV)).toBe(false);
    expect(isCommentaryAllowed('fonte-sem-tradicao', null, ADV)).toBe(false);
  });

  it('fonte escondida vence a tradição aceita', () => {
    const pref: CommentaryPreference = { traditions: ['adventist'], hiddenSources: ['egw-steps'] };
    expect(isCommentaryAllowed('egw-steps', 'adventist', pref)).toBe(false);
    expect(isCommentaryAllowed('egw-patriarchs', 'adventist', pref)).toBe(true);
  });

  it('fonte escondida some mesmo sem filtro de tradição', () => {
    const pref: CommentaryPreference = { traditions: null, hiddenSources: ['sword-luther'] };
    expect(isCommentaryAllowed('sword-luther', 'lutheran', pref)).toBe(false);
    expect(isCommentaryAllowed('sword-kd', 'lutheran', pref)).toBe(true);
  });

  it('lê preferência válida e preserva as listas', () => {
    expect(parseCommentaryPreference({ traditions: ['adventist', 'reformed'], hiddenSources: ['egw-steps'] })).toEqual({
      traditions: ['adventist', 'reformed'],
      hiddenSources: ['egw-steps'],
    });
  });

  it('entrada inválida vira ALL_COMMENTARIES', () => {
    for (const bad of [null, undefined, 'adventist', 42, [], { traditions: 'adventist' }, { traditions: 7, hiddenSources: 'x' }]) {
      expect(parseCommentaryPreference(bad)).toEqual(ALL_COMMENTARIES);
    }
  });

  it('descarta itens que não são texto, repetidos e lista vazia de tradições (vira todas)', () => {
    expect(parseCommentaryPreference({ traditions: ['', 3, 'adventist', 'adventist'], hiddenSources: [null, 'egw-steps'] })).toEqual({
      traditions: ['adventist'],
      hiddenSources: ['egw-steps'],
    });
    expect(parseCommentaryPreference({ traditions: [], hiddenSources: [] })).toEqual(ALL_COMMENTARIES);
  });
});
