// Descrição de uma entidade (pessoa, lugar, evento, grupo). Com descrição pt da fonte (entity_text), mostra o pt, sem
// tradução automática e sem aviso de tradução; "Ver original" discreto mostra o inglês. Sem pt, a tradução automática
// de antes (AutoTranslateNote). A escolha do texto é shownDescription (domínio).
import { useState } from 'react';
import { View } from 'react-native';
import { shownDescription, type DescriptionFields } from '@sensus/core';
import { LinkButton, Txt } from '@/design';
import { AutoTranslateNote } from './AutoTranslateNote';
import { useAutoTranslate } from './useAutoTranslate';
import { TR } from './strings';

export function EntityDescription({
  entity,
  lang,
  variant,
  testID,
  noteTestID,
  small = false,
}: {
  entity: DescriptionFields;
  /** Idioma da fonte da descrição em inglês (para a tradução automática). */
  lang: string | null | undefined;
  /** 'full': painel (texto inteiro, selecionável). 'excerpt': cartão (até três linhas). */
  variant: 'full' | 'excerpt';
  testID?: string;
  noteTestID?: string;
  /** Corpo menor (cartão de lugar). */
  small?: boolean;
}) {
  const [english, setEnglish] = useState(false);
  const hasPt = !!entity.descriptionPt?.trim();
  // Com a descrição pt, nada passa pela tradução automática (nem oferta, nem lote), nem quando o inglês é pedido.
  const tr = useAutoTranslate(hasPt ? null : entity.description, lang);
  const shown = shownDescription(entity, !english);
  if (!shown) return null;

  const body = hasPt ? shown.text : tr.display;
  const text =
    variant === 'full' ? (
      <Txt v="fullText" selectable testID={testID}>
        {body}
      </Txt>
    ) : (
      <Txt v="excerpt" numberOfLines={3} style={small ? { fontSize: 13 } : undefined} testID={testID}>
        {body}
      </Txt>
    );

  if (!hasPt) {
    return (
      <>
        {text}
        <AutoTranslateNote tr={tr} testID={noteTestID} />
      </>
    );
  }
  // Só mostra "Ver original" quando há o inglês para mostrar (senão o pt fica sempre).
  const canShowEnglish = !!entity.description?.trim();
  return (
    <>
      {text}
      {canShowEnglish ? (
        <View testID={noteTestID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingTop: 2 }}>
          {english ? (
            <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>
              {TR.descriptionOriginalNote}
            </Txt>
          ) : null}
          <LinkButton
            testID={noteTestID ? `${noteTestID}-toggle` : undefined}
            label={english ? TR.descriptionShowPt : TR.descriptionShowOriginal}
            onPress={() => setEnglish((v) => !v)}
          />
        </View>
      ) : null}
    </>
  );
}
