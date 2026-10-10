import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import type { Block, CiteIndex, CiteRef, ClaimInfo, Inline, MorphConflict } from '@sensus/core';
import { t } from '@/i18n';
import { Meta } from '@/ui/text';
import { readingFont, useCiteTones, useTheme } from '@/ui/theme';
import { useSheets } from './sheets';

/** Dados compartilhados por todo o texto rico (evita passar tudo por props). */
interface RenderCtx {
  index: CiteIndex | undefined;
  tone: ReturnType<typeof useCiteTones>['tone'];
  theme: ReturnType<typeof useTheme>;
  openCite: (citeId: string) => void;
  openToken: (tokenCiteId: string) => void;
}

/**
 * Renderiza blocos de texto rico (cabeçalhos, parágrafos, listas, citações) com
 * citações inline, sinalização de inferência/afirmação sem fonte e divergências morfológicas.
 */
export function RichText({ blocks, index }: { blocks: Block[]; index?: CiteIndex }) {
  const theme = useTheme();
  const tones = useCiteTones();
  const sheets = useSheets();
  const ctx: RenderCtx = {
    index,
    tone: tones.tone,
    theme,
    openCite: sheets.openCite,
    openToken: sheets.openToken,
  };
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} ctx={ctx} />
      ))}
    </View>
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 20 : block.level === 2 ? 17 : 15;
      return (
        <Text
          accessibilityRole="header"
          style={{ color: ctx.theme.text, fontSize: size, fontWeight: '700', lineHeight: size * 1.4, marginTop: 4 }}
        >
          <InlineRun inlines={block.inlines} ctx={ctx} />
        </Text>
      );
    }
    case 'paragraph':
      return (
        <ClaimFrame claim={block.claim} ctx={ctx}>
          <Body inlines={block.inlines} ctx={ctx} />
        </ClaimFrame>
      );
    case 'quote':
      return (
        <ClaimFrame claim={block.claim} ctx={ctx} quote>
          <Body inlines={block.inlines} ctx={ctx} italic />
        </ClaimFrame>
      );
    case 'list':
      return (
        <View style={{ gap: 8 }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ color: ctx.theme.accent, fontSize: 15, lineHeight: 23, minWidth: 16, textAlign: 'right' }}>
                {block.ordered ? `${i + 1}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>
                <ClaimFrame claim={item.claim} ctx={ctx}>
                  <Body inlines={item.inlines} ctx={ctx} />
                </ClaimFrame>
              </View>
            </View>
          ))}
        </View>
      );
  }
}

function Body({ inlines, ctx, italic = false }: { inlines: Inline[]; ctx: RenderCtx; italic?: boolean }) {
  return (
    <Text style={{ color: ctx.theme.text, fontSize: 15, lineHeight: 24, fontStyle: italic ? 'italic' : 'normal' }}>
      <InlineRun inlines={inlines} ctx={ctx} />
    </Text>
  );
}

/** Sequência de inlines dentro de um Text pai (texto, grego, grupos de citação). */
function InlineRun({ inlines, ctx }: { inlines: Inline[]; ctx: RenderCtx }) {
  return (
    <>
      {inlines.map((inline, i) => {
        switch (inline.type) {
          case 'text':
            return (
              <Text key={i} style={styleOf(inline.bold, inline.italic)}>
                {inline.text}
              </Text>
            );
          case 'original': {
            const tappable = inline.tokenCiteId !== undefined;
            const style: TextStyle = {
              fontFamily: readingFont,
              color: ctx.theme.text,
              fontStyle: inline.italic ? 'italic' : 'normal',
              fontWeight: inline.bold ? '700' : '400',
              textDecorationLine: tappable ? 'underline' : 'none',
              textDecorationStyle: 'dotted',
              textDecorationColor: ctx.theme.accent,
            };
            return tappable ? (
              <Text
                key={i}
                accessibilityRole="button"
                onPress={() => ctx.openToken(inline.tokenCiteId as string)}
                style={style}
              >
                {inline.text}
              </Text>
            ) : (
              <Text key={i} style={style}>
                {inline.text}
              </Text>
            );
          }
          case 'cite':
            return (
              <Text key={i}>
                {inline.refs.map((ref, j) => (
                  <CiteSpan key={`${ref.citeId}-${j}`} cite={ref} ctx={ctx} />
                ))}
              </Text>
            );
        }
      })}
    </>
  );
}

/** Chip de citação inline: texto com fundo colorido pela tabela de origem. */
function CiteSpan({ cite, ctx }: { cite: CiteRef; ctx: RenderCtx }) {
  if (!cite.valid) {
    return (
      <Text
        accessibilityLabel={t('study.invalidCite')}
        style={{
          color: ctx.theme.danger,
          textDecorationLine: 'line-through',
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {` ${cite.label} `}
      </Text>
    );
  }
  const tone = ctx.tone(ctx.index?.get(cite.citeId)?.table);
  return (
    <Text
      accessibilityRole="link"
      onPress={() => ctx.openCite(cite.citeId)}
      style={{ backgroundColor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: '600' }}
    >
      {` ${cite.label} `}
    </Text>
  );
}

function styleOf(bold?: boolean, italic?: boolean): TextStyle {
  return {
    fontWeight: bold ? '700' : '400',
    fontStyle: italic ? 'italic' : 'normal',
  };
}

/** Moldura conforme a confiabilidade do bloco: inferência (tinta), mistura (aviso) ou fonte. */
function ClaimFrame({
  claim,
  ctx,
  quote = false,
  children,
}: {
  claim: ClaimInfo;
  ctx: RenderCtx;
  quote?: boolean;
  children: ReactNode;
}) {
  const inference = claim.kind === 'inference';
  const mixed = claim.kind === 'mixed';
  const borderLeft = inference
    ? ctx.theme.inferenceBorder
    : mixed
      ? ctx.theme.warnText
      : quote
        ? ctx.theme.accent
        : undefined;
  const framed = inference || mixed || quote;
  return (
    <View
      style={{
        backgroundColor: inference ? ctx.theme.inference : 'transparent',
        borderLeftWidth: framed ? 3 : 0,
        borderLeftColor: borderLeft,
        paddingLeft: framed ? 12 : 0,
        paddingVertical: inference ? 10 : framed ? 2 : 0,
        paddingRight: inference ? 10 : 0,
        borderRadius: inference ? 10 : 0,
        gap: 8,
      }}
    >
      {inference ? <Tag label={t('study.inference')} ctx={ctx} /> : null}
      {children}
      <ClaimFooter claim={claim} ctx={ctx} />
    </View>
  );
}

function Tag({ label, ctx }: { label: string; ctx: RenderCtx }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: ctx.theme.inferenceBorder,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: ctx.theme.bg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Avisos: frases sem fonte (expansível) e divergências gramaticais em relação ao token citado. */
function ClaimFooter({ claim, ctx }: { claim: ClaimInfo; ctx: RenderCtx }) {
  const [expanded, setExpanded] = useState(false);
  const hasUncited = claim.kind === 'mixed' && claim.uncited.length > 0;
  if (!hasUncited && claim.morphConflicts.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {hasUncited ? (
        <View style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <WarnBadge ctx={ctx} />
            <Text style={{ color: ctx.theme.warnText, fontSize: 12, fontWeight: '600' }}>
              {t('rich.uncited')} {expanded ? '−' : '+'}
            </Text>
          </Pressable>
          {expanded
            ? claim.uncited.map((sentence, i) => (
                <Text key={i} style={{ color: ctx.theme.textMuted, fontSize: 13, lineHeight: 19, fontStyle: 'italic' }}>
                  {sentence}
                </Text>
              ))
            : null}
        </View>
      ) : null}
      {claim.morphConflicts.map((conflict, i) => (
        <MorphWarning key={i} conflict={conflict} ctx={ctx} />
      ))}
    </View>
  );
}

function MorphWarning({ conflict, ctx }: { conflict: MorphConflict; ctx: RenderCtx }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
      <WarnBadge ctx={ctx} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: ctx.theme.warnText, fontSize: 12, lineHeight: 17 }}>
          {t('rich.morphConflict', { expected: conflict.expected })}
        </Text>
        <Meta>{t('rich.morphTerm', { term: conflict.term })}</Meta>
      </View>
    </View>
  );
}

function WarnBadge({ ctx }: { ctx: RenderCtx }) {
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: ctx.theme.warn,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: ctx.theme.warnText, fontSize: 11, fontWeight: '800', lineHeight: 13 }}>!</Text>
    </View>
  );
}

/** Perguntas sugeridas: chips tocáveis que quebram linha (texto inteiro visível). */
export function QuestionChips({
  questions,
  onAsk,
  disabled = false,
}: {
  questions: string[];
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  if (questions.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      {questions.map((q, i) => (
        <Pressable
          key={`${i}-${q}`}
          accessibilityRole="button"
          accessibilityLabel={q}
          disabled={disabled}
          onPress={() => onAsk(q)}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: theme.accent, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{q}</Text>
        </Pressable>
      ))}
    </View>
  );
}
