// Botão "voltar" do sistema em camadas: fecha sempre a camada mais à frente.
// Cada sobreposição registra-se com useBackLayer(...) enquanto está aberta; a tela base instala
// useRootBackHandler(), que fecha a camada de maior prioridade ou, sem camadas, confirma a saída do app.
import { useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/** Prioridade = distância do usuário (maior = mais à frente). */
export const BACK_PRIORITY = {
  /** Painéis empilhados (palavra, fonte, entidade): fecha um por vez. */
  panel: 60,
  /** Prévia de citação. */
  popover: 50,
  /** Menus de contexto (⋯ de afirmação etc.). */
  menu: 45,
  /** Chat flutuante aberto. */
  chat: 40,
  /** Seletor de livros/capítulos. */
  picker: 35,
  /** "Ir para…". */
  jump: 34,
  /** Folha de estudo (fecha a seleção). */
  sheet: 20,
  /** Referência fixada no topo do leitor. */
  pinned: 10,
} as const;

interface Layer {
  priority: number;
  /** Ordem de abertura, para desempatar camadas de mesma prioridade (a mais recente primeiro). */
  order: number;
  close: () => void;
}

const layers = new Map<string, Layer>();
let counter = 0;

/**
 * Registra uma camada enquanto `open` for true. `close` deve fechar só esta camada
 * (ex.: o chat minimiza; a folha limpa a seleção; o painel volta um nível).
 */
export function useBackLayer(id: string, open: boolean, close: () => void, priority: number) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    layers.set(id, { priority, order: ++counter, close: () => closeRef.current() });
    return () => {
      layers.delete(id);
    };
  }, [id, open, priority]);
}

/** Fecha a camada mais à frente. Retorna false se não havia nenhuma. */
export function closeTopLayer(): boolean {
  let top: Layer | null = null;
  for (const l of layers.values()) {
    if (!top || l.priority > top.priority || (l.priority === top.priority && l.order > top.order)) top = l;
  }
  if (!top) return false;
  top.close();
  return true;
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
        if (closeTopLayer()) return true;
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
