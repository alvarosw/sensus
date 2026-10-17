import { beforeEach, describe, expect, it } from 'vitest';
import { useStudy, type Attachment } from './index';

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

describe('vezes da conversa', () => {
  it('startTurn leva os anexos atuais para a vez, limpa os anexos e devolve o id', () => {
    useStudy.getState().attach(verse);
    const id = useStudy.getState().startTurn('O que é kenosis?', { start: 50002005, end: 50002008 });
    const s = useStudy.getState();
    expect(s.attachments).toEqual([]);
    expect(s.thread).toHaveLength(1);
    expect(s.thread[0]).toEqual({
      id,
      question: 'O que é kenosis?',
      attachments: [verse],
      range: { start: 50002005, end: 50002008 },
      answer: '',
      status: 'streaming',
    });
  });

  it('ids de vezes diferentes são distintos', () => {
    const a = useStudy.getState().startTurn('um', null);
    const b = useStudy.getState().startTurn('dois', null);
    expect(a).not.toBe(b);
  });

  it('appendTurn acumula a resposta e tira o "pensando"', () => {
    const id = useStudy.getState().startTurn('p', null);
    useStudy.getState().setTurnThinking(id, true);
    useStudy.getState().appendTurn(id, 'Olá, ');
    useStudy.getState().appendTurn(id, 'mundo.');
    const t = useStudy.getState().thread[0];
    expect(t?.answer).toBe('Olá, mundo.');
    expect(t?.thinking).toBe(false);
  });

  it('finishTurn com o chat fechado soma uma não lida; com o chat aberto, não', () => {
    const id = useStudy.getState().startTurn('p', null);
    useStudy.getState().finishTurn(id);
    expect(useStudy.getState().unread).toBe(1);
    expect(useStudy.getState().thread[0]?.status).toBe('done');

    useStudy.getState().openChat();
    const id2 = useStudy.getState().startTurn('q', null);
    useStudy.getState().finishTurn(id2);
    expect(useStudy.getState().unread).toBe(0);
  });

  it('finishTurn com erro marca a vez como erro', () => {
    const id = useStudy.getState().startTurn('p', null);
    useStudy.getState().finishTurn(id, 'sem conexão');
    const t = useStudy.getState().thread[0];
    expect(t?.status).toBe('error');
    expect(t?.error).toBe('sem conexão');
  });

  it('resetTurn zera a resposta e o erro e volta a streaming', () => {
    const id = useStudy.getState().startTurn('p', null);
    useStudy.getState().appendTurn(id, 'parcial');
    useStudy.getState().finishTurn(id, 'falhou');
    useStudy.getState().resetTurn(id);
    expect(useStudy.getState().thread[0]).toMatchObject({ answer: '', status: 'streaming', error: undefined });
  });

  it('setTurnThinking não cria mudança quando o valor já é o mesmo', () => {
    const id = useStudy.getState().startTurn('p', null);
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
