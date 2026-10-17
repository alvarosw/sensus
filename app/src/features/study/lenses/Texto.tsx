// Lente Texto: traduções lado a lado (BLivre, KJV) ou o original do testamento do trecho (TR no NT, WLC no AT),
// e as variantes entre edições (só onde o trecho tem corpus com mais de uma edição-base: o NT grego).
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { editionVariantsOfRange, originalTextOf, originalTokensByVid, sourceShort, variantSites, type PanelData, type Token, type Vid } from '@sensus/core';
import { Empty, fontFamilies, Greek, LinkButton, Segmented, SubHeader, Txt, space, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { bareWord, chv } from '@/features/common/format';
import { LensShell } from '../LensShell';
import { VariantCard } from '../cards';
import { compareRows, selectedVids, textoCountLabel, type CompareRow } from '../lens-model';
import { STUDY } from '../strings';
import { useStudyData } from '../useStudyData';
import { Body, Cards, SECTION_LABEL, useExpanded, type LensProps } from './shared';

const COMPARE_SHOWN = 8;

function CompareLine({ row, onWord }: { row: CompareRow; onWord: (t: Token) => void }) {
  const { c } = useTheme();
  const label = <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 10, color: c.muted }}>{`${chv(row.vid)}  `}</Text>;
  if (row.kind === 'original') {
    // Hebraico: o parágrafo inteiro lê da direita para a esquerda; o número do versículo fica no início (à direita).
    const rtl = row.dir === 'rtl';
    return (
      <Txt v="excerpt" style={{ fontSize: 14.5, lineHeight: 23, writingDirection: row.dir, textAlign: rtl ? 'right' : undefined }}>
        {label}
        {row.tokens.map((t, i) => (
          <Greek key={t.cite_id} base="excerpt" dir={row.dir} onPress={() => onWord(t)}>
            {`${bareWord(t.surface)}${i < row.tokens.length - 1 ? ' ' : ''}`}
          </Greek>
        ))}
      </Txt>
    );
  }
  return (
    <Txt v="excerpt" style={{ fontSize: 14.5, lineHeight: 23 }}>
      {label}
      {row.kind === 'text' ? row.text : '—'}
    </Txt>
  );
}

function CompareText({ panel, vids }: { panel: PanelData; vids: Vid[] }) {
  const compare = useStudy((s) => s.compare);
  const pushPanel = useStudy((s) => s.pushPanel);
  const expanded = useStudy((s) => !!s.expanded['texto-cmp']);
  const toggle = useStudy((s) => s.toggleExpanded);
  const shown = expanded ? vids : vids.slice(0, COMPARE_SHOWN);
  const originals = useMemo(() => originalTokensByVid(panel.layers.text.original), [panel]);
  const rows = compareRows(shown, compare, panel.layers.text.translations, originals);

  return (
    <View style={{ gap: space[3] }} testID="compare">
      {rows.map((row) => (
        <CompareLine key={row.vid} row={row} onWord={(t) => pushPanel({ kind: 'word', tokenCiteId: t.cite_id })} />
      ))}
      {vids.length > COMPARE_SHOWN && (
        <View style={{ flexDirection: 'row' }}>
          <LinkButton label={expanded ? STUDY.seeLess : `${STUDY.seeAll} ${vids.length}`} onPress={() => toggle('texto-cmp')} />
        </View>
      )}
      {compare === 'original' && (
        <Txt v="meta" color="muted" style={{ fontSize: 11 }}>
          {STUDY.originalHint(sourceShort(originalTextOf('NT')), sourceShort(originalTextOf('OT')))}
        </Txt>
      )}
    </View>
  );
}

export function TextoLens({ onLayout }: LensProps) {
  const data = useStudyData();
  const compare = useStudy((s) => s.compare);
  const setCompare = useStudy((s) => s.setCompare);
  const expanded = useExpanded('texto');
  const { panel, range, books } = data;
  // Variantes só existem se o trecho tem um corpus com mais de uma edição-base (domínio); no AT a seção não aparece.
  const editions = useMemo(() => editionVariantsOfRange(range), [range]);
  const sites = useMemo(() => (panel && editions ? variantSites(panel.layers.text.original) : []), [panel, editions]);
  const vids = useMemo(() => (panel ? selectedVids(panel.layers.text.translations, range) : []), [panel, range]);
  const shown = expanded ? sites : sites.slice(0, 2);
  const st = useStudy.getState;

  return (
    <LensShell
      lens="texto"
      title={SECTION_LABEL.texto}
      count={panel ? textoCountLabel(vids.length, editions ? sites.length : null) : undefined}
      sourcesN={sites.length > 2 ? sites.length : 0}
      onLayout={onLayout}
    >
      <Body data={data}>
        {(p) => (
          <View style={{ gap: space[6] }}>
            <SubHeader label={STUDY.translations} />
            <Segmented
              testID="compare-seg"
              value={compare}
              onChange={setCompare}
              options={[
                { key: 'blivre', label: STUDY.cmpBlivre },
                { key: 'kjv', label: STUDY.cmpKjv },
                { key: 'original', label: STUDY.cmpOriginal },
              ]}
            />
            <CompareText panel={p} vids={vids} />
            {editions && <SubHeader label={STUDY.variantsTitle} />}
            {editions && (shown.length === 0 ? (
              <Empty text={STUDY.variantsEmpty(editions.list)} />
            ) : (
              <Cards>
                {shown.map((s) => {
                  const readings = s.readings.map((r) => ({ editions: r.editions, text: r.tokens.map((t) => bareWord(t.surface)).join(' ') }));
                  const first = s.readings.find((r) => r.tokens.length > 0)?.tokens[0];
                  const label = `Variante ${chv(s.vid)}: ${readings.map((r) => r.text || 'omite').join(' × ')}`;
                  return (
                    <VariantCard
                      key={`${s.vid}-${s.readings[0]?.tokens[0]?.pos ?? s.readings[1]?.tokens[0]?.pos ?? 0}`}
                      vid={s.vid}
                      readings={readings}
                      books={books}
                      onAnalyze={() => first && st().pushPanel({ kind: 'word', tokenCiteId: first.cite_id })}
                      onAsk={() => {
                        const ids = s.readings.flatMap((r) => r.tokens.map((t) => t.cite_id));
                        const store = st();
                        store.attach({ id: `var:${s.vid}:${s.readings[0]?.tokens[0]?.pos ?? 0}`, kind: 'variant', label, citeIds: ids });
                        store.openChat();
                      }}
                    />
                  );
                })}
              </Cards>
            ))}
          </View>
        )}
      </Body>
    </LensShell>
  );
}
