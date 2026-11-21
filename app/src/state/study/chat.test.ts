import { beforeEach, describe, expect, it } from 'vitest';
import { historyFor, unitKeyOf, useStudy, type Attachment } from './index';

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

const verse: Attachment = { id: 'vid:50002005', kind: 'verse', label: 'Fp 2:5' };
const cite: Attachment = { id: 'cite-1', kind: 'cite', label: 'Calvino', citeIds: ['cite-1'] };

describe('anexos', () => {
  it('attach não duplica um anexo com o mesmo id', () => {
    useStudy.getState().attach(verse);
    useStudy.getState().attach({ ...verse, label: 'outro rótulo' });
    expect(useStudy.getState().attachments).toEqual([verse]);
  });

  it('detach remove pelo id e clearAttachments esvazia', () => {
    useStudy.getState().attach(verse);
    useStudy.getState().attach(cite);
    useStudy.getState().detach(verse.id);
    expect(useStudy.getState().attachments).toEqual([cite]);
    useStudy.getState().clearAttachments();
    expect(useStudy.getState().attachments).toEqual([]);
  });
});

const FP = { start: 50002005, end: 50002011 };
const GN = { start: 1001001, end: 1002003 };

describe('vezes da conversa', () => {
  it('startTurn leva os anexos dados para a vez, com o trecho dela, e não mexe nos anexos do composer', () => {
    useStudy.getState().attach(verse);
    const id = useStudy.getState().startTurn('O que é kenosis?', { start: 50002005, end: 50002008 }, [verse], unitKeyOf(FP));
    const s = useStudy.getState();
    expect(s.attachments).toEqual([verse]);
    expect(s.thread).toHaveLength(1);
    expect(s.thread[0]).toEqual({
      id,
      question: 'O que é kenosis?',
      attachments: [verse],
      range: { start: 50002005, end: 50002008 },
      unitKey: '50002005-50002011',
      answer: '',
      status: 'streaming',
    });
  });

  it('startTurn com anexos explícitos (lista vazia) não manda os anexos do composer', () => {
    useStudy.getState().attach(verse);
    const id = useStudy.getState().startTurn('Pergunta sugerida', null, [], unitKeyOf(FP));
    expect(useStudy.getState().thread.find((t) => t.id === id)?.attachments).toEqual([]);
    expect(useStudy.getState().attachments).toEqual([verse]);
  });

  it('ids de vezes diferentes são distintos', () => {
    const a = useStudy.getState().startTurn('um', null, [], 'k');
    const b = useStudy.getState().startTurn('dois', null, [], 'k');
    expect(a).not.toBe(b);
  });

  it('appendTurn acumula a resposta e tira o "pensando"', () => {
    const id = useStudy.getState().startTurn('p', null, [], 'k');
    useStudy.getState().setTurnThinking(id, true);
    useStudy.getState().appendTurn(id, 'Olá, ');
    useStudy.getState().appendTurn(id, 'mundo.');
    const t = useStudy.getState().thread[0];
    expect(t?.answer).toBe('Olá, mundo.');
    expect(t?.thinking).toBe(false);
  });

  it('finishTurn com o chat fechado soma uma não lida; com o chat aberto, não', () => {
    const id = useStudy.getState().startTurn('p', null, [], 'k');
    useStudy.getState().finishTurn(id);
    expect(useStudy.getState().unread).toBe(1);
    expect(useStudy.getState().thread[0]?.status).toBe('done');

    useStudy.getState().openChat();
    const id2 = useStudy.getState().startTurn('q', null, [], 'k');
    useStudy.getState().finishTurn(id2);
    expect(useStudy.getState().unread).toBe(0);
  });

  it('finishTurn com erro marca a vez como erro', () => {
    const id = useStudy.getState().startTurn('p', null, [], 'k');
    useStudy.getState().finishTurn(id, 'sem conexão');
    const t = useStudy.getState().thread[0];
    expect(t?.status).toBe('error');
    expect(t?.error).toBe('sem conexão');
  });

  it('resetTurn zera a resposta e o erro e volta a streaming', () => {
    const id = useStudy.getState().startTurn('p', null, [], 'k');
    useStudy.getState().appendTurn(id, 'parcial');
    useStudy.getState().finishTurn(id, 'falhou');
    useStudy.getState().resetTurn(id);
    expect(useStudy.getState().thread[0]).toMatchObject({ answer: '', status: 'streaming', error: undefined });
  });

  it('setTurnThinking não cria mudança quando o valor já é o mesmo', () => {
    const id = useStudy.getState().startTurn('p', null, [], 'k');
    const before = useStudy.getState().thread[0];
    useStudy.getState().setTurnThinking(id, false);
    expect(useStudy.getState().thread[0]).toBe(before);
  });
});

describe('abrir o chat com uma pergunta', () => {
  it('askQuestion abre o chat, zera não lidas, fecha a prévia e deixa a pergunta pronta', () => {
    useStudy.setState({ unread: 3, popoverCite: 'x' });
    useStudy.getState().askQuestion('Quem foi Calvino?');
    const s = useStudy.getState();
    expect(s.chatOpen).toBe(true);
    expect(s.unread).toBe(0);
    expect(s.popoverCite).toBeNull();
    expect(s.pendingQuestion).toBe('Quem foi Calvino?');
    useStudy.getState().consumeQuestion();
    expect(useStudy.getState().pendingQuestion).toBeNull();
  });

  it('openChat zera as não lidas e fecha a prévia; closeChat só fecha', () => {
    useStudy.setState({ unread: 2, popoverCite: 'x' });
    useStudy.getState().openChat();
    expect(useStudy.getState()).toMatchObject({ chatOpen: true, unread: 0, popoverCite: null });
    useStudy.getState().closeChat();
    expect(useStudy.getState().chatOpen).toBe(false);
  });
});

describe('trocar de trecho', () => {
  const sel = (u: { start: number; end: number }) => unitKeyOf(u);

  it('primeiro trecho conhecido só registra a chave (anexos ficam, sem divisor)', () => {
    useStudy.getState().attach(verse);
    expect(useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11')).toEqual([]);
    expect(useStudy.getState()).toMatchObject({ unitKey: sel(FP), attachments: [verse], dividers: [] });
  });

  it('mesmo trecho não faz nada', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    useStudy.getState().attach(verse);
    expect(useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11')).toEqual([]);
    expect(useStudy.getState().attachments).toEqual([verse]);
  });

  it('mudar de trecho tira os anexos, devolve os que saíram e põe divisor se há vezes', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    useStudy.getState().attach(verse);
    useStudy.getState().startTurn('um', null, [verse], sel(FP));
    const removed = useStudy.getState().moveToUnit(sel(GN), 'Gn 1:1–2:3');
    const s = useStudy.getState();
    expect(removed).toEqual([verse]);
    expect(s.attachments).toEqual([]);
    expect(s.unitKey).toBe(sel(GN));
    expect(s.dividers).toEqual([{ at: 1, ref: 'Gn 1:1–2:3' }]);
  });

  it('duas mudanças sem pergunta entre elas deixam um divisor só, com o último nome', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    useStudy.getState().startTurn('um', null, [], sel(FP));
    useStudy.getState().moveToUnit(sel(GN), 'Gn 1:1–2:3');
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    expect(useStudy.getState().dividers).toEqual([{ at: 1, ref: 'Fp 2:5–11' }]);
  });

  it('desfazer devolve os anexos tirados (sem duplicar os que já estão lá)', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    useStudy.getState().attach(verse);
    const removed = useStudy.getState().moveToUnit(sel(GN), 'Gn 1:1–2:3');
    useStudy.getState().attach(cite);
    useStudy.getState().restoreAttachments(removed);
    useStudy.getState().restoreAttachments(removed);
    expect(useStudy.getState().attachments).toEqual([verse, cite]);
  });

  it('sem anexos, a mudança de trecho não tira nada e não devolve nada', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    expect(useStudy.getState().moveToUnit(sel(GN), 'Gn 1:1–2:3')).toEqual([]);
  });

  it('historyFor manda só as vezes do trecho atual, antes da vez dada', () => {
    const { startTurn, finishTurn } = useStudy.getState();
    const a = startTurn('de Fp', null, [], sel(FP));
    finishTurn(a);
    const g = startTurn('de Gn', null, [], sel(GN));
    finishTurn(g);
    const f2 = startTurn('de Fp de novo', null, [], sel(FP));
    const thread = useStudy.getState().thread;
    expect(historyFor(thread, sel(FP), f2).map((t) => t.question)).toEqual(['de Fp']);
    expect(historyFor(thread, sel(GN)).map((t) => t.question)).toEqual(['de Gn']);
    expect(historyFor(thread, sel(FP)).map((t) => t.question)).toEqual(['de Fp', 'de Fp de novo']);
    expect(historyFor(thread, sel(FP), 'nao-existe')).toEqual([]);
  });

  it('newConversation zera conversa, divisores, anexos e trecho', () => {
    useStudy.getState().moveToUnit(sel(FP), 'Fp 2:5–11');
    useStudy.getState().attach(verse);
    useStudy.getState().startTurn('um', null, [], sel(FP));
    useStudy.getState().moveToUnit(sel(GN), 'Gn 1:1–2:3');
    useStudy.getState().newConversation();
    expect(useStudy.getState()).toMatchObject({ thread: [], attachments: [], dividers: [], unitKey: null });
  });
});
