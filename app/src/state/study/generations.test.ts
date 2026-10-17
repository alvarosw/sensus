import { beforeEach, describe, expect, it } from 'vitest';
import { useStudy } from './index';

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

describe('gerações de IA', () => {
  it('setGeneration em chave nova cria uma geração ociosa e mescla o parcial', () => {
    useStudy.getState().setGeneration('50-1', { status: 'streaming' });
    expect(useStudy.getState().generations['50-1']).toEqual({ text: '', status: 'streaming' });
    useStudy.getState().setGeneration('50-1', { status: 'done' });
    expect(useStudy.getState().generations['50-1']).toEqual({ text: '', status: 'done' });
  });

  it('appendGeneration em chave nova começa em streaming e acumula o texto', () => {
    useStudy.getState().appendGeneration('11-15', 'Acab ');
    useStudy.getState().appendGeneration('11-15', 'reinou.');
    expect(useStudy.getState().generations['11-15']).toEqual({ text: 'Acab reinou.', status: 'streaming', thinking: false });
  });

  it('chegou texto, a geração deixa de estar pensando', () => {
    useStudy.getState().setGeneration('50-1', { status: 'streaming', thinking: true });
    useStudy.getState().appendGeneration('50-1', 'Olá');
    expect(useStudy.getState().generations['50-1']?.thinking).toBe(false);
  });

  it('chaves diferentes não se misturam', () => {
    useStudy.getState().appendGeneration('50-1', 'A');
    useStudy.getState().appendGeneration('50-1:texto', 'B');
    expect(useStudy.getState().generations['50-1']?.text).toBe('A');
    expect(useStudy.getState().generations['50-1:texto']?.text).toBe('B');
  });

  it('erro fica registrado sem apagar o texto já recebido', () => {
    useStudy.getState().appendGeneration('50-1', 'parcial');
    useStudy.getState().setGeneration('50-1', { status: 'error', error: 'falhou', thinking: false });
    expect(useStudy.getState().generations['50-1']).toEqual({ text: 'parcial', status: 'error', error: 'falhou', thinking: false });
  });
});
