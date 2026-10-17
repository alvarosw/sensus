// Renderiza Block[] (parseRichText / parseStructured*) com o design system: citações coloridas por tipo,
// grego tocável, estados de confiabilidade (moldura de inferência; frases de inferência destacadas; frases
// sem fonte com sublinhado pontilhado; divergência morfológica) e o menu ⋯ de cada afirmação
// (Detalhar este ponto / De onde vem isso? / Perguntar sobre isto).
import { memo, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { dirOf, scriptOf, type Block, type CiteRef, type ClaimInfo, type Inline } from '@sensus/core';
import {
  Caret,
  CitePill,
  ClaimFrame,
  Greek,
  fontFamilies,
  radius,
  sourceTypeOf,
  space,
  Txt,
  TypeMark,
  Card,
  CardTop,
  LinkButton,
  useTheme,
  useUncitedStyle,
} from '@/design';
import { BACK_PRIORITY, useBackLayer } from '../common/back';
import { useCite } from '../common/hooks';
import { useStudy } from '@/state/study';
import { morphLabelsPt, bareWord } from '../study/format';

/** Dados de uma afirmação, entregues às ações do menu ⋯. */
export interface ClaimMenuInfo {
  claimKey: string;
  /** Texto puro da afirmação (sem citações). */
  text: string;
  /** cite_ids citados na afirmação. */
  citeIds: string[];
  block: Block;
}

export interface RichBlocksProps {
  blocks: Block[];
  /** Mostra o cursor piscante no fim (texto em streaming). */
  streaming?: boolean;
  /** Prefixo das chaves de afirmação (ex.: "texto", "ans-<turnId>") — usado em anexos e testIDs. */
  claimKeyPrefix: string;
  /** Padrão: abre a prévia da fonte (store.openPopover). */
  onCite?: (citeId: string) => void;
  /** Padrão: abre o painel da palavra (store.pushPanel). */
  onToken?: (tokenCiteId: string) => void;
  /** Chamado quando o menu ⋯ de um parágrafo é aberto. */
  onClaimMore?: (claimKey: string, block: Block) => void;
  /** "Detalhar este ponto". Padrão: anexa a afirmação e pede "Explique melhor este ponto" ao chat. */
  onDeepen?: (info: ClaimMenuInfo) => void;
  /** "Perguntar sobre isto". Padrão: anexa a afirmação (store.attach) e abre o chat. */
  onAsk?: (info: ClaimMenuInfo) => void;
  /** false = sem menu ⋯. */
  claimMenu?: boolean;
}

interface Ctx {
  onCite: (citeId: string) => void;
  onToken: (tokenCiteId: string) => void;
  onClaimMore?: RichBlocksProps['onClaimMore'];
  onDeepen: (info: ClaimMenuInfo) => void;
  onAsk: (info: ClaimMenuInfo) => void;
  menu: boolean;
}

export function RichBlocks({
  blocks,
  streaming,
  claimKeyPrefix,
  onCite,
  onToken,
  onClaimMore,
  onDeepen,
  onAsk,
  claimMenu = true,
}: RichBlocksProps) {
  const openPopover = useStudy((s) => s.openPopover);
  const pushPanel = useStudy((s) => s.pushPanel);
  const attach = useStudy((s) => s.attach);
  const openChat = useStudy((s) => s.openChat);
  const askQuestion = useStudy((s) => s.askQuestion);

  const ctx = useMemo<Ctx>(() => {
    const defaultAsk = (info: ClaimMenuInfo) => {
      attach(claimAttachment(info));
      openChat();
    };
    return {
      onCite: onCite ?? openPopover,
      onToken: onToken ?? ((id) => pushPanel({ kind: 'word', tokenCiteId: id })),
      onClaimMore,
      onDeepen:
        onDeepen ??
        ((info) => {
          attach(claimAttachment(info));
          askQuestion('Explique melhor este ponto');
        }),
      onAsk: onAsk ?? defaultAsk,
      menu: claimMenu,
    };
  }, [onCite, onToken, onClaimMore, onDeepen, onAsk, claimMenu, openPopover, pushPanel, attach, openChat, askQuestion]);

  const last = blocks.length - 1;
  return (
    <View style={{ gap: space[6] }}>
      {blocks.map((block, i) => (
        <BlockView
          key={i}
          block={block}
          claimKey={`${claimKeyPrefix}-${i}`}
          ctx={ctx}
          caret={!!streaming && i === last}
        />
      ))}
    </View>
  );
}

export function claimAttachment(info: ClaimMenuInfo) {
  const short = info.text.length > 34 ? `${info.text.slice(0, 34).trim()}…` : info.text;
  return {
    id: `claim:${info.claimKey}`,
    kind: 'claim' as const,
    label: `“${short}”`,
    citeIds: info.citeIds.length > 0 ? info.citeIds : undefined,
    text: info.text,
  };
}

// ---- blocos ---------------------------------------------------------------------------------------

const BlockView = memo(function BlockView({ block, claimKey, ctx, caret }: { block: Block; claimKey: string; ctx: Ctx; caret: boolean }) {
  const { c } = useTheme();
  switch (block.type) {
    case 'heading':
      return (
        <Text accessibilityRole="header" style={{ marginTop: space[2] }}>
          <Inlines inlines={block.inlines} claim={null} ctx={ctx} v={block.level === 1 ? 'lensTitle' : 'body'} heading />
          {caret ? <Caret /> : null}
        </Text>
      );
    case 'paragraph':
      return <ClaimView inlines={block.inlines} claim={block.claim} block={block} claimKey={claimKey} ctx={ctx} caret={caret} />;
    case 'quote':
      return (
        <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 12 }}>
          <ClaimView inlines={block.inlines} claim={block.claim} block={block} claimKey={claimKey} ctx={ctx} caret={caret} italic />
        </View>
      );
    case 'list': {
      const lastItem = block.items.length - 1;
      return (
        <View style={{ gap: space[4] }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space[5] }}>
              <Txt v="claim" color="accent" style={{ minWidth: 16, textAlign: 'right' }}>
                {block.ordered ? `${i + 1}.` : '•'}
              </Txt>
              <View style={{ flex: 1 }}>
                <ClaimView
                  inlines={item.inlines}
                  claim={item.claim}
                  block={block}
                  claimKey={`${claimKey}-${i}`}
                  ctx={ctx}
                  caret={caret && i === lastItem}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }
  }
});

// ---- afirmação (parágrafo / item) ------------------------------------------------------------------

function inlinesToText(inlines: readonly Inline[]): string {
  return inlines
    .map((i) => (i.type === 'cite' ? '' : i.text))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1')
    .trim();
}

function citeIdsOf(inlines: readonly Inline[]): string[] {
  const ids: string[] = [];
  for (const i of inlines) {
    if (i.type !== 'cite') continue;
    for (const r of i.refs) for (const id of r.citeIds ?? [r.citeId]) if (r.valid && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function ClaimView({
  inlines,
  claim,
  block,
  claimKey,
  ctx,
  caret,
  italic,
}: {
  inlines: Inline[];
  claim: ClaimInfo;
  block: Block;
  claimKey: string;
  ctx: Ctx;
  caret: boolean;
  italic?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSources, setShowSources] = useState(false);
  useBackLayer(`menu-${claimKey}`, menuOpen, () => {
    setMenuOpen(false);
    setShowSources(false);
  }, BACK_PRIORITY.menu);
  const info = useMemo<ClaimMenuInfo>(
    () => ({ claimKey, text: inlinesToText(inlines), citeIds: citeIdsOf(inlines), block }),
    [claimKey, inlines, block],
  );
  const warning = useMemo(() => {
    const expected = [...new Set(claim.morphConflicts.map((m) => m.expected))];
    return expected.length > 0 ? expected.map((e) => `O token citado é ${e}`).join(' · ') : undefined;
  }, [claim.morphConflicts]);

  const showMore = ctx.menu && !caret;
  return (
    <View style={{ gap: space[3] }}>
      <ClaimFrame
        testID={`claim-${claimKey}`}
        kind={claim.kind}
        morphWarning={warning}
        onMore={
          showMore
            ? () => {
                if (!menuOpen) ctx.onClaimMore?.(claimKey, block);
                setMenuOpen((v) => !v);
                if (menuOpen) setShowSources(false);
              }
            : undefined
        }
      >
        <Inlines inlines={inlines} claim={claim} ctx={ctx} v="claim" italic={italic} />
        {caret ? <Caret /> : null}
      </ClaimFrame>
      {menuOpen && (
        <ClaimMenu
          info={info}
          ctx={ctx}
          sourcesOpen={showSources}
          onToggleSources={() => setShowSources((v) => !v)}
          onDone={() => {
            setMenuOpen(false);
            setShowSources(false);
          }}
        />
      )}
    </View>
  );
}

function MenuChip({ label, onPress, testID, active }: { label: string; onPress: () => void; testID?: string; active?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? c.chip : c.surfaceAlt,
        borderRadius: radius.md,
        paddingHorizontal: 9,
        paddingVertical: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Txt v="meta" style={{ fontSize: 12 }}>{label}</Txt>
    </Pressable>
  );
}

function ClaimMenu({
  info,
  ctx,
  sourcesOpen,
  onToggleSources,
  onDone,
}: {
  info: ClaimMenuInfo;
  ctx: Ctx;
  sourcesOpen: boolean;
  onToggleSources: () => void;
  onDone: () => void;
}) {
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {info.citeIds.length > 0 && (
          <MenuChip testID={`claim-src-${info.claimKey}`} label={`De onde vem isso? (${info.citeIds.length})`} active={sourcesOpen} onPress={onToggleSources} />
        )}
        <MenuChip
          testID={`claim-deepen-${info.claimKey}`}
          label="Detalhar este ponto"
          onPress={() => {
            onDone();
            ctx.onDeepen(info);
          }}
        />
        <MenuChip
          testID={`claim-ask-${info.claimKey}`}
          label="Perguntar sobre isto"
          onPress={() => {
            onDone();
            ctx.onAsk(info);
          }}
        />
      </View>
      {info.citeIds.length === 0 && <Txt v="meta" color="muted">Sem fontes neste parágrafo.</Txt>}
      {sourcesOpen && info.citeIds.length > 0 && (
        <View style={{ gap: space[3] }}>
          {info.citeIds.map((id) => (
            <MiniSource key={id} citeId={id} onOpen={ctx.onCite} />
          ))}
        </View>
      )}
    </View>
  );
}

// ---- mini card de fonte ("De onde vem isso?") --------------------------------------------------------

/** Tira o nome da fonte do início do rótulo ("TBESH H0935") quando a palavra que segue é grega ou hebraica. */
function stripSourcePrefix(label: string): string {
  const m = /^(\S+) (.+)$/u.exec(label);
  if (!m) return label;
  const script = scriptOf(m[2]!);
  return script === 'greek' || script === 'hebrew' ? m[2]! : label;
}

function MiniSource({ citeId, onOpen }: { citeId: string; onOpen: (id: string) => void }) {
  const kind = sourceTypeOf(citeId);
  const { loading, detail } = useCite(citeId);
  const title = detail ? (detail.kind === 'tok' || detail.kind === 'lex' ? stripSourcePrefix(detail.label) : detail.label) : citeId.split(':').slice(1).join(' · ');
  const excerpt =
    detail?.record.table === 'token'
      ? [detail.record.record.lemma, morphLabelsPt(detail.record.record.morph_desc, true).join(', '), detail.record.record.gloss_en ? `“${detail.record.record.gloss_en}”` : ''].filter(Boolean).join(' · ')
      : detail?.text ?? '';
  return (
    <Card style={{ paddingVertical: 9, paddingHorizontal: 10, gap: space[2] }}>
      <CardTop>
        <TypeMark kind={kind} label={detail?.typeLabel ?? kind} />
        {kind === 'tok' ? (
          <Greek base="bodySm" bold dir={dirOf(scriptOf(title))}>{title}</Greek>
        ) : (
          <Txt v="bodySm" bold numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
        )}
      </CardTop>
      {detail ? (
        <Txt v="excerpt" numberOfLines={3} style={{ fontSize: 13 }}>{excerpt}</Txt>
      ) : loading ? (
        <Txt v="bodySm" color="muted">…</Txt>
      ) : (
        <Txt v="bodySm" color="muted">Fonte não encontrada.</Txt>
      )}
      <LinkButton label="Abrir prévia" onPress={() => onOpen(citeId)} testID={`mini-src-${citeId}`} />
    </Card>
  );
}

// ---- inlines ---------------------------------------------------------------------------------------

interface Mark {
  start: number;
  end: number;
  kind: 'uncited' | 'inference' | 'morph';
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove acentos preservando o comprimento (um caractere → um caractere). */
function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += f.length === ch.length ? f : ch.toLowerCase();
  }
  return out;
}

/** Rótulo de inferência no texto já visível (o Markdown já tirou os asteriscos). */
const INFERENCE_VISIBLE_LABEL = /^\s*(?:\(\s*infer[êe]ncia\s*\)\s*:?|infer[êe]ncia\s*:)\s*/i;

/** Acha uma frase (das listas do ClaimInfo) no texto visível; ignora a marcação Markdown que o texto já não tem. */
function markSentence(texts: string, sentence: string, kind: 'uncited' | 'inference', marks: Mark[]): void {
  const words = sentence.replace(/[*_`]/g, '').match(/\S+/g);
  if (!words) return;
  const m = new RegExp(words.map(escapeRe).join('\\s*'), 'u').exec(texts);
  if (m) marks.push({ start: m.index, end: m.index + m[0].length, kind });
}

function marksFor(texts: string, claim: ClaimInfo | null): Mark[] {
  if (!claim) return [];
  const marks: Mark[] = [];
  // Frases sem citação (só em blocos 'mixed') e frases de inferência dentro de um bloco que não é inferência.
  if (claim.kind === 'mixed') for (const sentence of claim.uncited) markSentence(texts, sentence, 'uncited', marks);
  if (claim.kind !== 'inference') for (const sentence of claim.inference) markSentence(texts, sentence, 'inference', marks);
  if (claim.morphConflicts.length > 0) {
    const folded = fold(texts);
    for (const conflict of claim.morphConflicts) {
      const term = fold(conflict.term);
      let from = 0;
      for (;;) {
        const at = folded.indexOf(term, from);
        if (at < 0) break;
        marks.push({ start: at, end: at + term.length, kind: 'morph' });
        from = at + term.length;
      }
    }
  }
  return marks;
}

function Inlines({
  inlines,
  claim,
  ctx,
  v,
  italic,
  heading,
}: {
  inlines: Inline[];
  claim: ClaimInfo | null;
  ctx: Ctx;
  v: 'claim' | 'lensTitle' | 'body';
  italic?: boolean;
  heading?: boolean;
}) {
  const { c } = useTheme();
  const uncited = useUncitedStyle();
  const base = v === 'claim' ? fontFamilies.ui : v === 'lensTitle' ? fontFamilies.readSemibold : fontFamilies.uiBold;
  // O rótulo "(Inferência)" já sai do texto da moldura no núcleo (parseRichText); aqui só se desenha.

  const { texts, offsets } = useMemo(() => {
    let full = '';
    const offs: number[] = [];
    for (const inl of inlines) {
      offs.push(full.length);
      if (inl.type !== 'cite') full += inl.text;
    }
    return { texts: full, offsets: offs };
  }, [inlines]);
  const marks = useMemo(() => marksFor(texts, claim), [texts, claim]);

  const nodes: ReactNode[] = [];
  inlines.forEach((inl, i) => {
    if (inl.type === 'text') {
      const start = offsets[i]!;
      const end = start + inl.text.length;
      const local = marks.filter((m) => m.start < end && m.end > start).sort((a, b) => a.start - b.start);
      const style: TextStyle = {
        ...(inl.bold || heading ? { fontFamily: v === 'claim' ? fontFamilies.uiBold : base } : null),
        ...(inl.italic || italic ? { fontStyle: 'italic' } : null),
      };
      if (local.length === 0) {
        nodes.push(<Text key={i} style={style}>{inl.text}</Text>);
        return;
      }
      let cursor = start;
      const parts: ReactNode[] = [];
      const push = (a: number, b: number, kind?: Mark['kind']) => {
        if (b <= a) return;
        const piece = inl.text.slice(a - start, b - start);
        if (kind === 'inference') {
          // Frase de inferência dentro de um bloco com fonte: fundo azul e etiqueta no lugar do "(Inferência)".
          const label = INFERENCE_VISIBLE_LABEL.exec(piece);
          parts.push(
            <Text key={`${i}-${a}`} style={{ backgroundColor: c.inf }}>
              {label ? (
                <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: 10, letterSpacing: 0.6, color: c.infBorder }}>INFERÊNCIA  </Text>
              ) : null}
              {label ? piece.slice(label[0].length) : piece}
            </Text>,
          );
          return;
        }
        parts.push(
          <Text
            key={`${i}-${a}`}
            style={
              kind === 'uncited'
                ? uncited
                : kind === 'morph'
                  ? { textDecorationLine: 'underline', textDecorationColor: c.warnText }
                  : undefined
            }
          >
            {piece}
          </Text>,
        );
      };
      for (const m of local) {
        const a = Math.max(m.start, cursor);
        const b = Math.min(m.end, end);
        if (b <= a) continue;
        push(cursor, a);
        push(a, b, m.kind);
        cursor = b;
      }
      push(cursor, end);
      nodes.push(<Text key={i} style={style}>{parts}</Text>);
    } else if (inl.type === 'original') {
      nodes.push(
        <Greek
          key={i}
          base={v === 'claim' ? 'claim' : 'body'}
          bold={inl.bold}
          dir={dirOf(scriptOf(inl.text))}
          onPress={inl.tokenCiteId ? () => ctx.onToken(inl.tokenCiteId!) : undefined}
          testID={inl.tokenCiteId ? `tok-${inl.tokenCiteId}` : undefined}
        >
          {inl.text}
        </Greek>,
      );
    } else {
      const prev = inlines[i - 1];
      const needsSpace = !prev || prev.type === 'cite' ? false : !/\s$/.test(prev.text);
      nodes.push(
        <Text key={i}>
          {needsSpace ? ' ' : ''}
          {inl.refs.map((r, j) => (
            <CiteRefPill key={`${r.citeId}-${j}`} cite={r} onCite={ctx.onCite} />
          ))}
        </Text>,
      );
    }
  });

  return <Txt v={v} style={heading ? { fontFamily: base } : undefined}>{nodes}</Txt>;
}

function CiteRefPill({ cite, onCite }: { cite: CiteRef; onCite: (id: string) => void }) {
  return (
    <CitePill
      citeId={cite.citeId}
      label={cite.label}
      bad={!cite.valid}
      greekLabel={sourceTypeOf(cite.citeId) === 'tok'}
      onPress={() => onCite(cite.citeId)}
    />
  );
}

/** Texto comum com palavras em grego/hebraico em Gentium (tocáveis quando casam com um token). */
export { ScriptText } from './ScriptText';
