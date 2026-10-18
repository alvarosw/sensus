// Entrada do paralelo (sem linhas na tela): "Criar combinação" primeiro, depois os cartões de combinações — as do
// usuário (favoritas, recentes) e as prontas que completam até cinco. Tocar abre o paralelo com as linhas; a estrela
// favorita ou desfavorita; as do usuário podem ser removidas.
import { Pressable, ScrollView, View } from 'react-native';
import { Txt, radius, space, useTheme } from '@/design';
import { useTimelineNames } from '@/translate/timeline-translate';
import type { ComboCard, NameFields, TimelineLine } from '@sensus/core';
import { TL } from './strings';
import { SourceFooter, StarButton } from './parts';

export function CombinationEntry({
  cards,
  lineOf,
  onCreate,
  onOpen,
  onStar,
  onRemove,
}: {
  cards: ComboCard[];
  /** Linha pelo cite_id (undefined se não estiver na lista: o cartão mostra o nome vazio, como antes). */
  lineOf: (id: string) => TimelineLine | undefined;
  onCreate: () => void;
  onOpen: (card: ComboCard) => void;
  onStar: (card: ComboCard) => void;
  onRemove: (card: ComboCard) => void;
}) {
  const { c } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: space[8], gap: space[5] }}>
      <Txt v="lensTitle" tint={c.text}>{TL.emptyTitle}</Txt>
      <Txt v="meta" color="muted">{TL.emptyBody}</Txt>
      <Pressable
        testID="tl-create"
        accessibilityRole="button"
        accessibilityLabel={TL.createCombo}
        onPress={onCreate}
        style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.card, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[6], opacity: pressed ? 0.8 : 1 })}
      >
        <Txt v="button" tint={c.accentText}>{TL.createCombo}</Txt>
      </Pressable>
      <Txt v="eyebrow" color="muted" style={{ marginTop: space[3] }}>{TL.combos}</Txt>
      <View style={{ gap: space[3] }}>
        {cards.map((card) => (
          <ComboCardView
            key={card.id}
            card={card}
            lines={card.lines.map((id) => lineOf(id) ?? { name: '' })}
            onOpen={() => onOpen(card)}
            onStar={() => onStar(card)}
            onRemove={() => onRemove(card)}
          />
        ))}
      </View>
      <Txt v="meta" color="muted">{TL.comboOpenHint}</Txt>
      <SourceFooter />
    </ScrollView>
  );
}

/** Cartão de combinação: nome, linhas (traduzidas quando configurado), estrela e, nas do usuário, remover. */
function ComboCardView({ card, lines, onOpen, onStar, onRemove }: { card: ComboCard; lines: NameFields[]; onOpen: () => void; onStar: () => void; onRemove: () => void }) {
  const { c } = useTheme();
  const trLine = useTimelineNames(lines);
  const mine = card.source === 'mine';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingLeft: space[5], paddingRight: space[2], paddingVertical: space[3], borderWidth: 1, borderColor: c.border, borderRadius: radius.card, backgroundColor: c.surface }}>
      <Pressable
        testID={`tl-combo-${card.id}`}
        accessibilityRole="button"
        accessibilityLabel={card.name}
        onPress={onOpen}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 2, opacity: pressed ? 0.7 : 1 })}
      >
        <Txt v="bodySm" bold numberOfLines={1}>{card.name}</Txt>
        <Txt v="meta" color="muted" numberOfLines={2}>{lines.map((l) => trLine(l)).filter(Boolean).join(' · ')}</Txt>
      </Pressable>
      <StarButton
        on={card.favorite}
        label={card.favorite ? TL.comboUnfavorite(card.name) : TL.comboFavorite(card.name)}
        onPress={onStar}
        testID={`tl-combo-star-${card.id}`}
      />
      {mine && (
        <Pressable
          testID={`tl-combo-remove-${card.id}`}
          accessibilityRole="button"
          accessibilityLabel={TL.comboRemoveLabel(card.name)}
          onPress={onRemove}
          hitSlop={6}
          style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2], opacity: pressed ? 0.6 : 1 })}
        >
          <Txt v="meta" color="muted">{TL.comboRemove}</Txt>
        </Pressable>
      )}
    </View>
  );
}
