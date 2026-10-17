import { type ReactNode } from 'react';
import { Text } from 'react-native';
import { SCRIPT_WORD_RE } from '@sensus/core';
import { fontFamilies, Txt, type TxtProps } from '@/design';

/** Texto de interface com trechos em grego/hebraico em Gentium (proto: greekify). */
export function GreekText({ children, ...rest }: Omit<TxtProps, 'children'> & { children: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of children.matchAll(SCRIPT_WORD_RE)) {
    if (m.index > last) nodes.push(children.slice(last, m.index));
    nodes.push(
      <Text key={m.index} style={{ fontFamily: fontFamilies.greek, fontSize: 14 }}>
        {m[0]}
      </Text>,
    );
    last = m.index + m[0].length;
  }
  if (last < children.length) nodes.push(children.slice(last));
  return <Txt {...rest}>{nodes}</Txt>;
}
