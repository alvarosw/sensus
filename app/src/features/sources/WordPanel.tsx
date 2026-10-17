// Painel da palavra (token) e do lema (strong_base): morfologia, edições, léxico, concordância.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Card,
  EditionBadge,
  Empty,
  fontFamilies,
  LinkButton,
  Skeleton,
  SubHeader,
  Tag,
  Txt,
  TypeMark,
  useTheme,
} from '@/design';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { CORPUS, dirOf, scriptOf, sourceShort, type Testament, type Token, type Vid } from '@sensus/core';
import { useStudy } from '@/state/study';
import { showInText } from '../common/actions';
import { loadConcordance, loadLexicon, loadSources } from '../common/cites';
import { shortRef } from '../common/format';
import { useBooks, useCite } from '../common/hooks';
import { hebrewMorphPt } from '../common/morph-hb';
import { morphParts } from '../common/morph-pt';
import { SRC } from '../common/strings';
import { wordView } from '../common/word-view';
import { useAutoTranslate } from '@/translate/useAutoTranslate';
import { useTranslatable } from '@/translate/useTranslatable';
import { AutoTranslateNote } from '@/translate/AutoTranslateNote';
import { useSourceLang } from '@/translate/source-lang';
import { KeyValues, LicenseBlock, RefChips } from './PanelParts';

type WordEntry = { kind: 'word'; tokenCiteId: string } | { kind: 'lemma'; strongBase: string };

const LSJ_MAX = 8000;

export function WordPanel({ entry }: { entry: WordEntry }) {
  const tokenId = entry.kind === 'word' ? entry.tokenCiteId : null;
  const tokenState = useCite(tokenId);
  const token: Token | null =
    tokenState.detail && tokenState.detail.record.table === 'token' ? tokenState.detail.record.record : null;
  const strongBase = entry.kind === 'lemma' ? entry.strongBase : (token?.strong_base ?? null);

  if (tokenId && tokenState.loading) return <PanelSkeleton />;
  if (tokenId && !token) {
    return <Empty text={tokenState.error ? SRC.loadError : SRC.notFound} />;
  }
  return <WordBody token={token} strongBase={strongBase} fallbackId={tokenId ?? `lemma:${strongBase}`} />;
}

function PanelSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width="30%" />
      <Skeleton width="50%" height={30} />
      <Skeleton width="80%" />
      <Skeleton />
      <Skeleton width="70%" />
    </View>
  );
}

/** Linha de morfologia (chave/valor). english = o valor ainda está em inglês e vai à tradução automática. */
interface ClasseRow {
  key: string;
  value: string;
  english: boolean;
}

/**
 * Linhas de morfologia do token. Hebraico: a classe inteira pelo mapa (morph-hb); se algum termo ficar de fora, a
 * descrição original segue para a tradução. Grego: morphParts; valor com letra inglesa (termo fora do mapa) também.
 */
function classeRowsOf(desc: string, hebrew: boolean): ClasseRow[] {
  if (!desc) return [];
  if (hebrew) {
    const hb = hebrewMorphPt(desc);
    return hb.complete ? [{ key: 'Classe', value: hb.text, english: false }] : [{ key: 'Classe', value: desc, english: true }];
  }
  return morphParts(desc)
    .filter((p) => p.key !== 'Origem')
    .map((p) => ({ key: p.key, value: p.value, english: /[A-Za-z]/.test(p.value) }));
}

function WordBody({ token, strongBase, fallbackId }: { token: Token | null; strongBase: string | null; fallbackId: string }) {
  const { c } = useTheme();
  const repo = useRepo();
  const books = useBooks();
  const [showLsj, setShowLsj] = useState(false);

  const lexicon = useAsync(() => (strongBase ? loadLexicon(repo, strongBase) : Promise.resolve([])), [repo, strongBase]);
  const concordance = useAsync(
    () => (strongBase ? loadConcordance(repo, strongBase) : Promise.resolve({ count: 0, vids: [] as Vid[] })),
    [repo, strongBase],
  );
  const sources = useAsync(() => loadSources(repo), [repo]);

  // Língua, testamento e verbete pelo domínio: AT (hebraico/aramaico, TAHOT, TBESH) ou NT (grego, TAGNT, TBESG).
  const view = useMemo(() => wordView(token, strongBase, lexicon.data ?? []), [token, strongBase, lexicon.data]);
  const testament: Testament | null = view.testament;
  const lex = view.lex.primary;
  const lsj = view.lex.secondary;
  const lemma = token?.lemma ?? lex?.lemma ?? strongBase ?? '';
  const gloss = token?.gloss_en ?? lex?.gloss ?? null;
  const editions = token ? token.editions.split(',').map((e) => e.trim()).filter(Boolean) : [];

  // Classe: o mapa determinístico cobre o hebraico inteiro e o grego por morphParts; o que sobrar em inglês
  // (termo fora do mapa) vai à tradução automática, em lote com a glosa.
  const parts: ClasseRow[] = token ? classeRowsOf(token.morph_desc ?? '', testament === 'OT') : [];

  const count = concordance.data?.count ?? 0;
  const vids = useMemo(() => {
    const base = concordance.data?.vids ?? [];
    if (token && !base.includes(token.vid)) return [...base, token.vid].sort((a, b) => a - b);
    return base;
  }, [concordance.data, token]);
  const hapax = concordance.data != null && count === 1;
  const word = token ? token.surface.normalize('NFC').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '') : lemma;
  // Palavra isolada no cabeçalho: hebraico lido da direita para a esquerda (grego e latim, da esquerda).
  const wordDir = dirOf(scriptOf(word));

  const lexSources = [token ? sources.data?.get(token.source_id) : undefined, lex ? sources.data?.get(lex.source_id) : undefined];
  // Tradução automática: o idioma vem da fonte (en para TBESG e TFLSJ); o LSJ só é traduzido quando aberto.
  const lexLang = useSourceLang(lex?.source_id ?? null);
  const lsjLang = useSourceLang(lsj?.source_id ?? null);
  const lexTr = useAutoTranslate(lex?.definition ?? null, lexLang);
  const lsjText = lsj ? (lsj.definition.length > LSJ_MAX ? `${lsj.definition.slice(0, LSJ_MAX)}…` : lsj.definition) : null;
  const lsjTr = useAutoTranslate(showLsj ? lsjText : null, lsjLang);
  // Cabeçalho (glosa e classe em inglês) traduzido em um lote só, com uma nota. Glosa e classe são colunas em
  // inglês do banco, por isso o idioma é 'en' (a fonte do token tem o idioma da língua original).
  const headerEn = [gloss, ...parts.filter((r) => r.english).map((r) => r.value)].filter((t): t is string => !!t);
  const header = useTranslatable(headerEn, { lang: 'en', policy: 'item' });
  const licenseSummary = [
    token ? sourceShort(CORPUS[token.corpus].tokensSource) : null,
    lex ? sourceShort(lex.source_id, sources.data?.get(lex.source_id)?.title) : null,
  ]
    .filter(Boolean)
    .join(' e ');

  const ask = (citeId: string, label: string, kind: 'token' | 'cite') => {
    const s = useStudy.getState();
    s.attach({ id: citeId, kind, label, citeIds: [citeId] });
    s.closePanels();
    s.openChat();
  };

  return (
    <View style={{ gap: 12 }}>
      <TypeMark kind="tok" label={token ? `${SRC.word} · ${shortRef(token.vid, books)}` : `${SRC.lemma} · ${strongBase ?? ''}`} />
      <Text
        testID="word-hero"
        selectable
        style={{ fontFamily: fontFamilies.greek, fontSize: 34, lineHeight: 38, color: c.text, writingDirection: wordDir }}
      >
        {word}
      </Text>
      <Txt v="bodySm" color="muted" style={{ fontSize: 13.5, lineHeight: 20 }}>
        {token?.translit ? `${token.translit} · ` : lex?.translit ? `${lex.translit} · ` : ''}
        {token ? `${SRC.lemmaOf} ` : ''}
        {token ? <Text style={{ fontFamily: fontFamilies.greek, fontSize: 14.5 }}>{lemma}</Text> : null}
        {token ? ' · ' : ''}
        {token?.strong ?? strongBase ?? ''}
        {gloss ? ` · “${header.show(gloss)}”` : ''}
      </Txt>

      {parts.length > 0 ? <KeyValues rows={parts.map((p) => ({ key: p.key, value: p.english ? header.show(p.value) : p.value }))} /> : null}
      <AutoTranslateNote tr={header} testID="word-header-tr" />

      {editions.length > 0 ? (
        <>
          <SubHeader label={SRC.editions} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {editions.map((e) => (
              <EditionBadge key={e} edition={e} />
            ))}
          </View>
        </>
      ) : null}

      <SubHeader label={`${SRC.lexicon} · ${view.lexiconLabel}`} />
      {lexicon.loading ? (
        <Skeleton height={64} />
      ) : lex ? (
        <Card testID="word-lexicon">
          <Text style={{ fontFamily: fontFamilies.greek, fontSize: 20, lineHeight: 26, color: c.text, writingDirection: dirOf(scriptOf(lex.lemma ?? lemma)) }}>
            {lex.lemma ?? lemma}
            {lex.gloss ? <Text style={{ fontFamily: fontFamilies.ui, fontSize: 13, color: c.muted }}>{`  ${lex.gloss}`}</Text> : null}
          </Text>
          <Txt v="excerpt" style={{ fontSize: 13.5 }} selectable testID="word-lexicon-text">{lexTr.display}</Txt>
          <AutoTranslateNote tr={lexTr} testID="word-lexicon-tr" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
            {lsj ? (
              <LinkButton testID="word-lsj" label={showLsj ? SRC.hideLsj : SRC.seeLsj} onPress={() => setShowLsj((v) => !v)} />
            ) : null}
            <LinkButton
              testID="word-ask-meaning"
              label={SRC.askMeaning}
              onPress={() => ask(lex.cite_id, `${lex.lemma ?? lemma}`, 'cite')}
            />
          </View>
        </Card>
      ) : (
        <Empty text={SRC.noLexiconEntry(view.lexiconLabel)} />
      )}
      {showLsj && lsj ? (
        <>
          <SubHeader label={SRC.lexiconLsj} />
          <Card testID="word-lsj-card">
            <Txt v="excerpt" style={{ fontSize: 13.5 }} selectable testID="word-lsj-text">{lsjTr.display}</Txt>
            <AutoTranslateNote tr={lsjTr} testID="word-lsj-tr" />
          </Card>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SubHeader label={SRC.concordance(count, testament)} />
        </View>
        {hapax ? <Tag label={SRC.hapax} tone="tint" /> : null}
      </View>
      {concordance.loading ? (
        <Skeleton height={26} />
      ) : vids.length > 0 ? (
        <>
          <RefChips
            testIDPrefix="occ"
            vids={vids}
            books={books}
            here={token?.vid ?? null}
            onPress={(vid) => showInText(vid)}
          />
          {count > vids.length ? (
            <Txt v="meta" color="muted">{SRC.moreOccurrences(count - vids.length)}</Txt>
          ) : null}
        </>
      ) : (
        <Empty text={SRC.noOccurrences} />
      )}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: 8,
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingTop: 8,
        }}
      >
        {token ? (
          <>
            <LinkButton testID="word-ask" label={SRC.askForm} onPress={() => ask(token.cite_id, word, 'token')} />
            <LinkButton testID="word-show" label={SRC.show} onPress={() => showInText(token.vid)} />
          </>
        ) : lex ? (
          <LinkButton testID="word-ask" label={SRC.askMeaning} onPress={() => ask(lex.cite_id, lemma, 'cite')} />
        ) : null}
      </View>
      <LicenseBlock sources={lexSources} citeId={fallbackId} summary={licenseSummary || undefined} />
    </View>
  );
}
