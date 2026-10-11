// Botão "voltar" do sistema em camadas: esconde o teclado primeiro; depois fecha sempre a camada mais à frente.
// Cada sobreposição registra-se com useBackLayer(...) enquanto está aberta; a tela base instala
// useRootBackHandler(), que fecha a camada de maior prioridade ou, sem camadas, confirma a saída do app.
import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, Keyboard, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { backAction, closeTopLayer, registerBackLayer, topBackLayer } from './back-registry';

export { closeTopLayer } from './back-registry';

/** Prioridade = distância do usuário (maior = mais à frente). */
export const BACK_PRIORITY = {
  /** Painéis empilhados (palavra, fonte, entidade, mapa): fecha um por vez. */
  panel: 60,
  /** Prévia de citação. */
  popover: 50,
  /** Menus de contexto (⋯ de afirmação etc.) e texto selecionável da resposta. */
  menu: 45,
  /** Chat flutuante aberto. */
  chat: 40,
  /** Seletor de livros/capítulos. */
  picker: 35,
  /** "Ir para…". */
  jump: 34,
  /** Folha de estudo (fecha a seleção). */
  sheet: 20,
  /** Referência fixada no topo do leitor. Fixar é a última ação: um "voltar" remove a barra antes da folga. */
  pinned: 30,
} as const;

/**
 * Registra uma camada enquanto `open` for true. `close` deve fechar só esta camada
 * (ex.: o chat minimiza; a folha limpa a seleção; o painel volta um nível).
 * A camada é removida ao fechar ou desmontar; `close` sempre usa a versão mais recente (sem novo registro a cada render).
 */
export function useBackLayer(id: string, open: boolean, close: () => void, priority: number) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return undefined;
    return registerBackLayer(id, priority, () => closeRef.current());
  }, [id, open, priority]);
}

/**
 * Instale na tela base (index). Ativo só enquanto a tela está em foco: em outras rotas
 * (ex.: configurações) o "voltar" segue a navegação normal.
 */
export function useRootBackHandler(exitTitle = 'Sair do Sensus?', exitMessage = 'Seu estudo aberto será perdido.') {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const action = backAction(Keyboard.isVisible(), topBackLayer() !== null);
        if (action === 'dismiss-keyboard') {
          Keyboard.dismiss();
          return true;
        }
        if (action === 'close-layer') {
          closeTopLayer();
          return true;
        }
        Alert.alert(exitTitle, exitMessage, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });
      return () => sub.remove();
    }, [exitTitle, exitMessage]),
  );
}
