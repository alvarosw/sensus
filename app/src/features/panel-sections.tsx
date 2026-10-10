import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatReference, splitVid, type Book, type PanelData, type Token, type VerseText } from '@sensus/core';
import { t } from '@/i18n';
import { Button } from '@/ui/primitives';
import { Empty } from '@/ui/state';
import { Body, Label, Meta } from '@/ui/text';
import { readingFont, useTheme } from '@/ui/theme';
import { openSource } from './navigation';

type Layer = keyof PanelData['layers'];

const CAP = 6;

interface Props {
  layer: Layer;
  panel: PanelData;
  books: Book[];
}

/** Dados determinísticos de uma camada do painel, compactos e tocáveis (cada item abre a fonte). */
export function LayerContent({ layer, panel, books }: Props) {
  const { sources } = panel;
  const titleOf = (id: string) => sources[id]?.title ?? id;
  const ref = (start: number, end: number = start) => formatReference({ start, end }, books);
  const chapterVerse = (vid: number) => {
    const p = splitVid(vid);
    return `${p.chapter}:${p.verse}`;
  };

  const verse = (v: VerseText, prefix?: string) => (
    <Entry key={v.cite_id} onPress={() => openSource(v.cite_id)}>
      <Meta>
        {prefix ? `${prefix} · ` : ''}
        {titleOf(v.source_id)} · {chapterVerse(v.vid)}
      </Meta>
      <Body reading>{v.text}</Body>
    </Entry>
  );

  const token = (tok: Token, withVariant: boolean) => (
    <Entry key={tok.cite_id} onPress={() => openSource(tok.cite_id)}>
      <TokenHead token={tok} />
      <Meta>{[tok.lemma, tok.morph_desc ?? tok.morph, tok.strong].filter(Boolean).join(' · ')}</Meta>
      {tok.gloss_en ? <Body>{tok.gloss_en}</Body> : null}
      {withVariant ? (
        <Meta>
          {t('text.editions', { editions: tok.editions })}
          {tok.variant_note ? ` — ${tok.variant_note}` : ''}
        </Meta>
      ) : null}
    </Entry>
  );

  switch (layer) {
    case 'text': {
      const x = panel.layers.text;
      return (
        <View style={{ gap: 12 }}>
          <Group title={t('text.translations')} items={x.translations} render={(v) => verse(v)} />
          <Group title={t('text.original')} items={x.original} render={(tok) => token(tok, false)} />
          <Group title={t('text.variants')} items={x.variants} render={(tok) => token(tok, true)} />
        </View>
      );
    }
    case 'literary': {
      const x = panel.layers.literary;
      return (
        <View style={{ gap: 12 }}>
          <Group title={t('lit.before')} items={x.before} render={(v) => verse(v)} />
          <Group title={t('lit.after')} items={x.after} render={(v) => verse(v)} />
          <Group
            title={t('lit.divisions')}
            items={x.divisions}
            render={(d, i) => (
              <Entry key={`div-${i}`} onPress={() => openSource(`src:${d.source_id}`)}>
                <Meta>
                  {d.kind === 'heading' ? t('lit.heading') : t('lit.paragraph')} · {titleOf(d.source_id)} · {ref(d.vid)}
                </Meta>
                {d.title ? <Body>{d.title}</Body> : null}
              </Entry>
            )}
          />
          <Group
            title={t('lit.intro')}
            items={x.bookIntro}
            render={(e) => (
              <Entry key={e.cite_id} onPress={() => openSource(e.cite_id)}>
                <Meta>{titleOf(e.source_id)}</Meta>
                <Headword>{e.headword}</Headword>
                <Body lines={4}>{e.text}</Body>
              </Entry>
            )}
          />
        </View>
      );
    }
    case 'historical': {
      const x = panel.layers.historical;
      return (
        <View style={{ gap: 12 }}>
          <Group
            title={t('hist.entities')}
            items={x.entities}
            render={(e) => (
              <Entry key={e.cite_id} onPress={() => openSource(e.cite_id)}>
                <Meta>
                  {t(`entity.${e.type}` as 'entity.other')} · {titleOf(e.source_id)}
                </Meta>
                <Headword>{e.name}</Headword>
                {e.description ? <Body lines={3}>{e.description}</Body> : null}
              </Entry>
            )}
          />
          <Group
            title={t('hist.dictionary')}
            items={x.dictionary}
            render={(e) => (
              <Entry key={e.cite_id} onPress={() => openSource(e.cite_id)}>
                <Meta>{titleOf(e.source_id)}</Meta>
                <Headword>{e.headword}</Headword>
                <Body lines={4}>{e.text}</Body>
              </Entry>
            )}
          />
        </View>
      );
    }
    case 'language': {
      const x = panel.layers.language;
      const concordance = Object.entries(x.concordance);
      return (
        <View style={{ gap: 12 }}>
          <Group
            title={t('lang.lexicon')}
            items={x.lexicon}
            render={(e) => (
              <Entry key={e.cite_id} onPress={() => openSource(e.cite_id)}>
                <Meta>
                  {e.key}
                  {e.translit ? ` · ${e.translit}` : ''}
                  {e.lemma ? ` · ${e.lemma}` : ''} · {titleOf(e.source_id)}
                </Meta>
                {e.gloss ? <Headword>{e.gloss}</Headword> : null}
                <Body lines={5}>{e.definition}</Body>
              </Entry>
            )}
          />
          <Group
            title={t('lang.concordance')}
            items={concordance}
            render={([strong, entry]) => (
              <View key={strong} style={{ gap: 8 }}>
                <Headword>
                  {strong} · {t('lang.occurrences', { count: entry.count })}
                </Headword>
                {entry.samples.map((v) => verse(v))}
              </View>
            )}
          />
        </View>
      );
    }
    case 'intertext': {
      const x = panel.layers.intertext;
      return (
        <View style={{ gap: 12 }}>
          <Group
            title={t('inter.xrefs')}
            items={x.xrefs}
            render={(xr) => (
              <Entry key={xr.cite_id} onPress={() => openSource(xr.cite_id)}>
                <Meta>
                  {ref(xr.from_vid)} → {ref(xr.to_start_vid, xr.to_end_vid)}
                  {xr.weight !== null ? ` · ${t('inter.weight', { weight: xr.weight.toFixed(1) })}` : ''}
                </Meta>
                {xr.texts.slice(0, 2).map((v) => (
                  <Body key={v.cite_id} lines={3}>
                    {v.text}
                  </Body>
                ))}
              </Entry>
            )}
          />
          <Group
            title={t('inter.topics')}
            items={x.topics}
            render={(e) => (
              <Entry key={e.cite_id} onPress={() => openSource(e.cite_id)}>
                <Meta>{titleOf(e.source_id)}</Meta>
                <Headword>{e.headword}</Headword>
                <Body lines={3}>{e.text}</Body>
              </Entry>
            )}
          />
        </View>
      );
    }
    case 'interpretation': {
      const x = panel.layers.interpretation;
      return (
        <Group
          title={t('interp.commentaries')}
          items={x.commentaries}
          render={(c) => {
            const tradition = sources[c.source_id]?.tradition;
            return (
              <Entry key={c.cite_id} onPress={() => openSource(c.cite_id)}>
                <Meta>
                  {titleOf(c.source_id)}
                  {tradition ? ` · ${tradition}` : ''} · {ref(c.start_vid, c.end_vid)}
                </Meta>
                <Body lines={6}>{c.text}</Body>
              </Entry>
            );
          }}
        />
      );
    }
  }
}

/** Lista com rótulo; mostra CAP itens e um botão para ver o restante. */
function Group<T>({
  title,
  items,
  render,
}: {
  title: string;
  items: readonly T[];
  render: (item: T, index: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, CAP);
  return (
    <View style={{ gap: 8 }}>
      <Label>{title}</Label>
      {items.length === 0 ? <Empty /> : shown.map((item, i) => render(item, i))}
      {items.length > CAP ? (
        <Button
          label={all ? t('common.close') : t('common.showAll', { count: items.length })}
          variant="ghost"
          onPress={() => setAll((v) => !v)}
        />
      ) : null}
    </View>
  );
}

function Entry({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderLeftWidth: 2,
        borderLeftColor: theme.border,
        paddingLeft: 10,
        paddingVertical: 4,
        gap: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function Headword({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ fontWeight: '700', color: theme.text, fontSize: 15, lineHeight: 21 }}>{children}</Text>;
}

function TokenHead({ token }: { token: Token }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 18, color: theme.text, fontFamily: readingFont }}>{token.surface}</Text>
      {token.translit ? <Meta>{token.translit}</Meta> : null}
    </View>
  );
}
