import type { SectionKey, VerseRange } from '@sensus/core';

export type FixtureKind = 'summary' | 'section' | 'answer';

/** Resposta real do modelo, gravada por scripts/record-fixtures.ts e reproduzida pelo provedor 'demo'. */
export interface Fixture {
  version: 1;
  kind: FixtureKind;
  /** Referência como o painel a formata (ex.: "Filipenses 2:5-8"). */
  reference: string;
  range: VerseRange;
  section?: SectionKey;
  question?: string;
  model: string;
  recordedAt: string;
  /** Texto bruto do modelo, concatenando os pedaços do stream (marcadores @secao e [[cite_id]] incluídos). */
  text: string;
}
