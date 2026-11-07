import { describe, expect, it } from 'vitest';
import type { Source } from '@sensus/core';
import { commentaryGroups, describePreference, toggleHiddenSource, toggleTradition, visibleTradition } from './commentary-model';

const src = (id: string, kind: string, tradition: string | null, title = id): Source =>
  ({ id, kind, title, tradition, author: null, lang: 'en', license: 'Public Domain' }) as unknown as Source;

// Recorte do banco: NT grego (reformada, dispensacional) e AT hebraico (adventista, luterana) + não-comentários.
const BANCO: Source[] = [
  src('blivre', 'text', null, 'Bíblia Livre'),
  src('com-ref', 'commentary', 'reformed', 'Comentário Reformado'),
  src('com-disp', 'commentary', 'dispensational', 'Comentário Dispensacional'),
  src('smith-daniel', 'commentary', 'adventist', 'Smith'),
  src('egw-steps', 'commentary', 'adventist', 'Caminho a Cristo'),
  src('sword-kd', 'commentary', 'lutheran', 'Keil e Delitzsch'),
  src('sem-tradicao', 'commentary', null, 'Sem tradição'),
];

describe('grupos de tradição (fontes do banco ativo)', () => {
  it('agrupa só comentários com tradição, pelo rótulo pt-BR, com as fontes de cada grupo', () => {
    const groups = commentaryGroups(BANCO);
    expect(groups.map((g) => g.tradition)).toEqual(['adventist', 'dispensational', 'lutheran', 'reformed']);
    expect(groups.map((g) => g.label)).toEqual(['adventista', 'dispensacionalista', 'luterana', 'reformada']);
    expect(groups.find((g) => g.tradition === 'adventist')?.sources.map((s) => s.id)).toEqual(['egw-steps', 'smith-daniel']);
  });

  it('não-comentário e comentário sem tradição ficam de fora', () => {
    const ids = commentaryGroups(BANCO).flatMap((g) => g.sources.map((s) => s.id));
    expect(ids).not.toContain('blivre');
    expect(ids).not.toContain('sem-tradicao');
  });
});

describe('alternar tradições', () => {
  it('com "todas" (null), marcar uma significa só ela (NT: reformada)', () => {
    expect(toggleTradition(null, 'reformed')).toEqual(['reformed']);
  });

  it('marca mais uma e desmarca; desmarcar a última volta para todas', () => {
    expect(toggleTradition(['reformed'], 'dispensational')).toEqual(['reformed', 'dispensational']);
    expect(toggleTradition(['reformed', 'dispensational'], 'reformed')).toEqual(['dispensational']);
    expect(toggleTradition(['dispensational'], 'dispensational')).toBeNull();
  });

  it('AT: marcar a adventista e a luterana, e tirar a adventista', () => {
    const both = toggleTradition(toggleTradition(null, 'adventist'), 'lutheran');
    expect(both).toEqual(['adventist', 'lutheran']);
    expect(toggleTradition(both, 'adventist')).toEqual(['lutheran']);
  });
});

describe('fontes escondidas e tradição visível', () => {
  it('esconde e mostra uma fonte pelo id', () => {
    expect(toggleHiddenSource([], 'egw-steps')).toEqual(['egw-steps']);
    expect(toggleHiddenSource(['egw-steps'], 'egw-steps')).toEqual([]);
    expect(toggleHiddenSource(['egw-steps'], 'smith-daniel')).toEqual(['egw-steps', 'smith-daniel']);
  });

  it('tradição escolhida no estudo some quando a preferência a esconde', () => {
    expect(visibleTradition('adventista', ['adventista', 'luterana'])).toBe('adventista');
    expect(visibleTradition('reformada', ['adventista', 'luterana'])).toBeNull();
    expect(visibleTradition(null, ['adventista'])).toBeNull();
  });
});

describe('describePreference (resumo da linha de Configurações)', () => {
  // Tabela pt fixa no teste, para não depender do idioma do store.
  const pt = {
    allTraditions: 'Todas as tradições',
    onlyTradition: (a: string) => `Só ${a}`,
    twoTraditions: (a: string, b: string) => `${a.charAt(0).toUpperCase()}${a.slice(1)} e ${b}`,
    manyTraditions: (a: string, b: string, more: number) => `${a.charAt(0).toUpperCase()}${a.slice(1)}, ${b} e mais ${more}`,
    hiddenSources: (n: number) => (n === 1 ? '1 fonte oculta' : `${n} fontes ocultas`),
  };

  it('todas, uma, duas e mais de duas tradições, com rótulos do núcleo', () => {
    expect(describePreference({ traditions: null, hiddenSources: [] }, 'pt', pt)).toBe('Todas as tradições');
    expect(describePreference({ traditions: ['adventist'], hiddenSources: [] }, 'pt', pt)).toBe('Só adventista');
    expect(describePreference({ traditions: ['adventist', 'reformed'], hiddenSources: [] }, 'pt', pt)).toBe('Adventista e reformada');
    expect(describePreference({ traditions: ['adventist', 'reformed', 'patristic', 'lutheran'], hiddenSources: [] }, 'pt', pt)).toBe(
      'Adventista, reformada e mais 2',
    );
  });

  it('fontes ocultas no singular e no plural', () => {
    expect(describePreference({ traditions: null, hiddenSources: ['egw-steps'] }, 'pt', pt)).toBe('Todas as tradições · 1 fonte oculta');
    expect(describePreference({ traditions: ['adventist'], hiddenSources: ['a', 'b', 'c'] }, 'pt', pt)).toBe('Só adventista · 3 fontes ocultas');
  });

  it('rótulo da tradição segue o idioma pedido', () => {
    expect(describePreference({ traditions: ['adventist'], hiddenSources: [] }, 'es', { ...pt, onlyTradition: (a) => `Solo ${a}` })).toBe('Solo adventista');
  });
});
