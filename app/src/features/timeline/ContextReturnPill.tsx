// Pílula "Voltar à linha do tempo" no leitor: aparece depois de "Ler no texto" na cronologia do trecho e reabre a
// cronologia no mesmo ponto de rolagem. Fica logo abaixo da barra superior (a folha de estudo cobre o rodapé).
// "Dispensar" a esconde sem voltar.
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt, radius, space, useTheme } from '@/design';
import { TL } from './strings';
import { useContextReturn } from './context-return';

export function ContextReturnPill({ top }: { top: number }) {
  const back = useContextReturn((s) => s.back);
  const { c } = useTheme();
  const router = useRouter();
  if (!back) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top, flexDirection: 'row', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], backgroundColor: c.accent, borderRadius: radius.pill, paddingLeft: space[6], paddingRight: space[2] }}>
        <Pressable
          testID="ctx-return"
          accessibilityRole="button"
          onPress={() => {
            const target = useContextReturn.getState().resumeNow();
            if (!target) return;
            router.push({
              pathname: '/timeline/contexto',
              params: { de: String(target.span.start), ate: String(target.span.end), escopo: target.scope },
            });
          }}
          style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
        >
          <Txt v="button" tint={c.accentText}>{TL.returnPill}</Txt>
        </Pressable>
        <Pressable
          testID="ctx-return-dismiss"
          accessibilityRole="button"
          accessibilityLabel={TL.dismissReturn}
          onPress={() => useContextReturn.getState().dismiss()}
          hitSlop={6}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt v="button" tint={c.accentText}>×</Txt>
        </Pressable>
      </View>
    </View>
  );
}
