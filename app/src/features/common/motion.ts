// Animação de entrada/saída das camadas (chat, prévia, painéis, aviso): progresso 0..1 com a curva do design system.
import { useEffect, useRef, useState } from 'react';
import { Easing, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { motion } from '@/design';

export const EASE = Easing.bezier(...motion.easing);

export interface Presence {
  /** 0 = fora, 1 = dentro. */
  progress: SharedValue<number>;
  /** Fica true até a animação de saída terminar. */
  mounted: boolean;
}

/** Progresso animado de uma camada que entra e sai; respeita "reduzir movimento". */
export function usePresence(open: boolean, duration: number): Presence {
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(open);
  const first = useRef(true);
  useEffect(() => {
    const d = reduce ? 0 : duration;
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: d, easing: EASE });
    } else if (first.current) {
      progress.value = 0;
    } else {
      progress.value = withTiming(0, { duration: d, easing: EASE }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, duration, reduce]);
  return { progress, mounted };
}

/** Último valor não nulo: mantém o conteúdo na tela durante a animação de saída. */
export function useLast<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) ref.current = value;
  return ref.current;
}
