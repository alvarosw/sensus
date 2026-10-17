// Ações da linha do tempo que saem da tela: abrir o leitor nos versículos de um evento.
import { router } from 'expo-router';
import type { Vid } from '@sensus/core';
import { useStudy } from '@/state/study';
import { useReaderNav } from '@/state/reader-nav';

/**
 * Leva o leitor aos versículos [first, last]: mesma seleção e mesmo destaque de "ir para" usados pelo trecho de
 * Histórico. Fecha as telas da linha do tempo e volta ao leitor (que fica na base da pilha).
 */
export function openInReader(first: Vid, last: Vid): void {
  useStudy.getState().setSelection(first, last);
  useReaderNav.getState().goVerse(first, { flash: true });
  router.dismissTo('/');
}
