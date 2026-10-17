import { beforeEach, describe, expect, it } from 'vitest';
import { useStudy, type PanelEntry } from './index';

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

const word = (id: string): PanelEntry => ({ kind: 'word', tokenCiteId: id });

describe('painéis empilhados', () => {
  it('pushPanel empilha e fecha a prévia', () => {
    useStudy.getState().openPopover('fonte-1');
    useStudy.getState().pushPanel(word('a'));
    useStudy.getState().pushPanel({ kind: 'lemma', strongBase: 'G26' });
    expect(useStudy.getState().panels).toEqual([word('a'), { kind: 'lemma', strongBase: 'G26' }]);
    expect(useStudy.getState().popoverCite).toBeNull();
  });

  it('popPanel remove só o último', () => {
    useStudy.getState().pushPanel(word('a'));
    useStudy.getState().pushPanel(word('b'));
    useStudy.getState().popPanel();
    expect(useStudy.getState().panels).toEqual([word('a')]);
  });

  it('popPanelsTo mantém a pilha até o índice dado, inclusive', () => {
    ['a', 'b', 'c', 'd'].forEach((id) => useStudy.getState().pushPanel(word(id)));
    useStudy.getState().popPanelsTo(1);
    expect(useStudy.getState().panels).toEqual([word('a'), word('b')]);
  });

  it('closePanels esvazia a pilha', () => {
    useStudy.getState().pushPanel(word('a'));
    useStudy.getState().closePanels();
    expect(useStudy.getState().panels).toEqual([]);
  });

  it('openPopover e closePopover alternam a prévia', () => {
    useStudy.getState().openPopover('fonte-1');
    expect(useStudy.getState().popoverCite).toBe('fonte-1');
    useStudy.getState().closePopover();
    expect(useStudy.getState().popoverCite).toBeNull();
  });
});
