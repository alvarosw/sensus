import { Text, View } from 'react-native';
import { formatReference, type Book, type PanelData, type Token, type VerseText } from '@sensus/core';
import { t } from '@/i18n';
import { CollapsibleSection, Item } from '@/ui/primitives';
import { Body, Label, Meta } from '@/ui/text';
import { Empty } from '@/ui/state';
import { readingFont, useTheme } from '@/ui/theme';
import { openSource } from './navigation';

interface Props {
  panel: PanelData;
  books: Book[];
}

/** Painel hermenêutico: seis camadas, renderizadas de forma determinística. */
export function PanelSections({ panel, books }: Props) {
  const theme = useTheme();
  const { layers, sources } = panel;
  const titleOf = (id: string) => sources[id]?.title ?? id;
  const ref = (start: number, end: number = start) => formatReference({ start, end }, books);

  const verse = (v: VerseText, prefix?: string) => (
    <Item key={v.cite_id} onPress={() => openSource(v.cite_id)} accessibilityLabel={ref(v.vid)}>
      <Meta>
        {prefix ? `${prefix} · ` : ''}
        {titleOf(v.source_id)} · {ref(v.vid)}
      </Meta>
      <Body reading>{v.text}</Body>
    </Item>
  );

  const token = (tok: Token, withVariant: boolean) => (
    <Item key={tok.cite_id} onPress={() => openSource(tok.cite_id)}>
      <TokenHead token={tok} />
      <Meta>
        {[tok.lemma, tok.morph_desc ?? tok.morph, tok.strong].filter(Boolean).join(' · ')}
      </Meta>
      {tok.gloss_en ? <Body>{tok.gloss_en}</Body> : null}
      {withVariant ? (
        <Meta>
          {t('text.editions', { editions: tok.editions })}
          {tok.variant_note ? ` — ${tok.variant_note}` : ''}
        </Meta>
      ) : null}
    </Item>
  );

  const text = layers.text;
  const lit = layers.literary;
  const hist = layers.historical;
  const lang = layers.language;
  const inter = layers.intertext;
  const interp = layers.interpretation;

  const concordance = Object.entries(lang.concordance);

  return (
    <View style={{ gap: 12 }}>
      <CollapsibleSection
        title={t('section.text')}
        count={text.translations.length + text.original.length}
        defaultOpen
      >
        <Label>{t('text.translations')}</Label>
        {text.translations.length ? text.translations.map((v) => verse(v)) : <Empty />}

        <Label>{t('text.original')}</Label>
        {text.original.length ? text.original.map((tok) => token(tok, false)) : <Empty />}

        <Label>{t('text.variants')}</Label>
        {text.variants.length ? text.variants.map((tok) => token(tok, true)) : <Empty />}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('section.literary')}
        count={lit.before.length + lit.after.length + lit.divisions.length + lit.bookIntro.length}
      >
        <Label>{t('lit.before')}</Label>
        {lit.before.length ? lit.before.map((v) => verse(v)) : <Empty />}

        <Label>{t('lit.after')}</Label>
        {lit.after.length ? lit.after.map((v) => verse(v)) : <Empty />}

        <Label>{t('lit.divisions')}</Label>
        {lit.divisions.length ? (
          lit.divisions.map((d, i) => (
            <Item key={`div-${d.source_id}-${d.vid}-${d.kind}-${i}`} onPress={() => openSource(`src:${d.source_id}`)}>
              <Meta>
                {d.kind === 'heading' ? t('lit.heading') : t('lit.paragraph')} · {titleOf(d.source_id)} ·{' '}
                {ref(d.vid)}
              </Meta>
              {d.title ? <Body>{d.title}</Body> : null}
            </Item>
          ))
        ) : (
          <Empty />
        )}

        <Label>{t('lit.intro')}</Label>
        {lit.bookIntro.length ? (
          lit.bookIntro.map((e) => (
            <Item key={e.cite_id} onPress={() => openSource(e.cite_id)}>
              <Meta>{titleOf(e.source_id)}</Meta>
              <Text style={{ fontWeight: '700', color: theme.text }}>{e.headword}</Text>
              <Body lines={4}>{e.text}</Body>
            </Item>
          ))
        ) : (
          <Empty />
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t('section.historical')} count={hist.entities.length + hist.dictionary.length}>
        <Label>{t('hist.entities')}</Label>
        {hist.entities.length ? (
          hist.entities.map((e) => (
            <Item key={e.cite_id} onPress={() => openSource(e.cite_id)}>
              <Meta>
                {t(`entity.${e.type}` as 'entity.other')} · {titleOf(e.source_id)}
              </Meta>
              <Text style={{ fontWeight: '700', color: theme.text }}>{e.name}</Text>
              {e.description ? <Body lines={3}>{e.description}</Body> : null}
            </Item>
          ))
        ) : (
          <Empty />
        )}

        <Label>{t('hist.dictionary')}</Label>
        {hist.dictionary.length ? (
          hist.dictionary.map((e) => (
            <Item key={e.cite_id} onPress={() => openSource(e.cite_id)}>
              <Meta>{titleOf(e.source_id)}</Meta>
              <Text style={{ fontWeight: '700', color: theme.text }}>{e.headword}</Text>
              <Body lines={4}>{e.text}</Body>
            </Item>
          ))
        ) : (
          <Empty />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('section.language')}
        count={lang.lexicon.length + concordance.length}
      >
        <Label>{t('lang.lexicon')}</Label>
        {lang.lexicon.length ? (
          lang.lexicon.map((e) => (
            <Item key={e.cite_id} onPress={() => openSource(e.cite_id)}>
              <Meta>
                {e.key}
                {e.translit ? ` · ${e.translit}` : ''}
                {e.lemma ? ` · ${e.lemma}` : ''} · {titleOf(e.source_id)}
              </Meta>
              {e.gloss ? <Text style={{ fontWeight: '700', color: theme.text }}>{e.gloss}</Text> : null}
              <Body lines={5}>{e.definition}</Body>
            </Item>
          ))
        ) : (
          <Empty />
        )}

        <Label>{t('lang.concordance')}</Label>
        {concordance.length ? (
          concordance.map(([strong, entry]) => (
            <View key={strong} style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', color: theme.text }}>
                {strong} · {t('lang.occurrences', { count: entry.count })}
              </Text>
              {entry.samples.map((v) => verse(v))}
            </View>
          ))
        ) : (
          <Empty />
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t('section.intertext')} count={inter.xrefs.length + inter.topics.length}>
        <Label>{t('inter.xrefs')}</Label>
        {inter.xrefs.length ? (
          inter.xrefs.map((x) => (
            <Item key={x.cite_id} onPress={() => openSource(x.cite_id)}>
              <Meta>
                {ref(x.from_vid)} → {ref(x.to_start_vid, x.to_end_vid)}
                {x.weight !== null ? ` · ${t('inter.weight', { weight: x.weight.toFixed(1) })}` : ''}
              </Meta>
              {x.texts.map((v) => (
                <Body key={v.cite_id} lines={3}>
                  {v.text}
                </Body>
              ))}
            </Item>
          ))
        ) : (
          <Empty />
        )}

        <Label>{t('inter.topics')}</Label>
        {inter.topics.length ? (
          inter.topics.map((e) => (
            <Item key={e.cite_id} onPress={() => openSource(e.cite_id)}>
              <Meta>{titleOf(e.source_id)}</Meta>
              <Text style={{ fontWeight: '700', color: theme.text }}>{e.headword}</Text>
              <Body lines={3}>{e.text}</Body>
            </Item>
          ))
        ) : (
          <Empty />
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t('section.interpretation')} count={interp.commentaries.length}>
        <Label>{t('interp.commentaries')}</Label>
        {interp.commentaries.length ? (
          interp.commentaries.map((c) => {
            const source = sources[c.source_id];
            const tradition = source?.tradition ? ` · ${source.tradition}` : '';
            return (
              <Item key={c.cite_id} onPress={() => openSource(c.cite_id)}>
                <Meta>
                  {titleOf(c.source_id)}
                  {tradition} · {ref(c.start_vid, c.end_vid)}
                </Meta>
                <Body lines={6}>{c.text}</Body>
              </Item>
            );
          })
        ) : (
          <Empty />
        )}
      </CollapsibleSection>
    </View>
  );
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
