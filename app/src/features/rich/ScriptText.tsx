import { useMemo } from 'react';
import { wordKey } from '@sensus/core';
import { Greek, Txt, type TypeVariant } from '@/design';
import { useStudy } from '@/state/study';

const SCRIPT_RE = /[Ͱ-Ͽἀ-῿֐-׿][Ͱ-Ͽἀ-῿֐-׿\p{M}’']*/gu;

/**
 * Texto de fonte (comentário, verbete) com o grego/hebraico em Gentium. `tokens` (palavra → cite_id do token)
 * torna as palavras que casam tocáveis (abrem o painel da palavra).
 */
export function ScriptText({
  text,
  v = 'excerpt',
  tokenByKey,
  numberOfLines,
  fontSize,
}: {
  text: string;
  v?: TypeVariant;
  tokenByKey?: ReadonlyMap<string, string>;
  numberOfLines?: number;
  fontSize?: number;
}) {
  const pushPanel = useStudy((s) => s.pushPanel);
  const nodes = useMemo(() => {
    const out: Array<{ t: string; script: boolean }> = [];
    let last = 0;
    for (const m of text.matchAll(SCRIPT_RE)) {
      if (m.index > last) out.push({ t: text.slice(last, m.index), script: false });
      out.push({ t: m[0], script: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: text.slice(last), script: false });
    return out;
  }, [text]);
  return (
    <Txt v={v} numberOfLines={numberOfLines} style={fontSize ? { fontSize } : undefined}>
      {nodes.map((n, i) => {
        if (!n.script) return n.t;
        const id = tokenByKey?.get(wordKey(n.t));
        return (
          <Greek key={i} base={v} onPress={id ? () => pushPanel({ kind: 'word', tokenCiteId: id }) : undefined}>
            {n.t}
          </Greek>
        );
      })}
    </Txt>
  );
}
