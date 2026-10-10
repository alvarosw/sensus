import { Text } from 'react-native';
import { fontFamilies, Txt, type TxtProps } from '@/design';

const GREEK = /([Ͱ-Ͽἀ-῿֐-׿]+)/u;

/** Texto de interface com trechos em grego/hebraico em Gentium (proto: greekify). */
export function GreekText({ children, ...rest }: Omit<TxtProps, 'children'> & { children: string }) {
  const parts = children.split(GREEK);
  return (
    <Txt {...rest}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: fontFamilies.greek, fontSize: 14 }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Txt>
  );
}
