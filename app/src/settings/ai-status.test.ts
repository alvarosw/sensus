import { describe, expect, it } from 'vitest';
import type { ProviderConfig } from '@sensus/core';
import { aiSummary, chatgptView, inUseLine, shortLabel, type AiSnapshot } from './ai-status';

const NOW = new Date(2026, 9, 11, 12, 0).getTime();
const at = (h: number, m: number) => new Date(2026, 9, 11, h, m).getTime();

const KEY: ProviderConfig = { id: 'nvidia', kind: 'openai-compatible', label: 'NVIDIA', baseUrl: 'https://x', apiKey: 'k', model: 'm' } as ProviderConfig;
const CHATGPT: ProviderConfig = { id: 'chatgpt', kind: 'chatgpt', label: 'ChatGPT', baseUrl: 'https://c', apiKey: '', model: 'gpt' } as ProviderConfig;

const base: AiSnapshot = {
  mode: 'auto',
  provider: null,
  account: null,
  attention: null,
  keySaved: false,
  keyLabel: 'NVIDIA',
  pause: null,
  now: NOW,
};
const connected = { connected: true, hasSession: true, planEnabled: true, email: 'conta@exemplo.com' };

describe('aiSummary (linha da lista principal)', () => {
  it('sem conta e sem chave: não configurado, com alerta', () => {
    expect(aiSummary(base)).toEqual({ subtitle: 'Não configurado', warn: 'not_configured' });
  });

  it('sem método agora, com chave salva: alerta de nenhum método', () => {
    expect(aiSummary({ ...base, keySaved: true })).toEqual({ subtitle: 'Nenhum método disponível', warn: 'no_method' });
  });

  it('ChatGPT pronto sem reserva: plano ativo, sem alerta', () => {
    expect(aiSummary({ ...base, account: connected, provider: CHATGPT })).toEqual({ subtitle: 'ChatGPT · plano ativo', warn: null });
  });

  it('ChatGPT com reserva da chave', () => {
    const provider = { ...CHATGPT, fallback: KEY };
    expect(aiSummary({ ...base, account: connected, keySaved: true, provider })).toEqual({
      subtitle: 'ChatGPT · reserva na chave de API',
      warn: null,
    });
  });

  it('só chave: nome do provedor, sem alerta', () => {
    expect(aiSummary({ ...base, keySaved: true, provider: KEY })).toEqual({ subtitle: 'Chave de API (NVIDIA)', warn: null });
  });

  it('limite com horário: volta às HH:MM (alerta)', () => {
    const s = aiSummary({ ...base, keySaved: true, provider: KEY, account: connected, pause: { until: at(14, 32), known: true } });
    expect(s).toEqual({ subtitle: 'Limite atingido · volta às 14:32', warn: 'paused' });
  });

  it('limite sem horário: nova tentativa às HH:MM', () => {
    const s = aiSummary({ ...base, keySaved: true, provider: KEY, account: connected, pause: { until: at(14, 42), known: false } });
    expect(s).toEqual({ subtitle: 'Limite atingido · nova tentativa às 14:42', warn: 'paused' });
  });

  it('a pausa só vale no modo Automático', () => {
    const s = aiSummary({ ...base, mode: 'chatgpt', account: connected, provider: CHATGPT, pause: { until: at(14, 32), known: true } });
    expect(s.warn).toBeNull();
  });

  it('pausa vencida não alerta', () => {
    const s = aiSummary({ ...base, keySaved: true, provider: KEY, pause: { until: NOW - 1, known: true }, now: NOW });
    expect(s.warn).toBeNull();
  });

  it('atenção de sessão: alerta e não usa a chave', () => {
    const s = aiSummary({ ...base, account: connected, attention: 'reauth', keySaved: true, provider: null });
    expect(s).toEqual({ subtitle: 'Atenção · entrar de novo no ChatGPT', warn: 'attention' });
  });

  it('conta sem plano: alerta', () => {
    const s = aiSummary({ ...base, account: connected, attention: 'not_eligible' });
    expect(s).toEqual({ subtitle: 'Atenção · conta sem plano para o Sensus', warn: 'attention' });
  });

  it('no modo Só chave a atenção do ChatGPT não aparece', () => {
    const s = aiSummary({ ...base, mode: 'key', account: connected, attention: 'reauth', keySaved: true, provider: KEY });
    expect(s).toEqual({ subtitle: 'Chave de API (NVIDIA)', warn: null });
  });
});

describe('inUseLine (Em uso agora)', () => {
  it('ChatGPT sem reserva', () => {
    expect(inUseLine({ ...base, account: connected, provider: CHATGPT })).toEqual({ lead: 'ChatGPT', rest: 'Sem reserva.' });
  });

  it('ChatGPT com reserva de chave', () => {
    expect(inUseLine({ ...base, account: connected, keySaved: true, provider: { ...CHATGPT, fallback: KEY } })).toEqual({
      lead: 'ChatGPT',
      rest: 'Reserva: chave de API (NVIDIA).',
    });
  });

  it('chave enquanto o ChatGPT está pausado', () => {
    const s = inUseLine({ ...base, keySaved: true, provider: KEY, account: connected, pause: { until: at(14, 32), known: true } });
    expect(s).toEqual({ lead: 'Chave de API (NVIDIA)', rest: 'até 14:32; depois, ChatGPT.' });
  });

  it('nenhum, por modo', () => {
    expect(inUseLine({ ...base, mode: 'key' }).rest).toBe('Falta a chave de API.');
    expect(inUseLine({ ...base, mode: 'chatgpt' }).rest).toMatch(/não está pronto/);
    expect(inUseLine(base).rest).toMatch(/Conecte o ChatGPT/);
  });

  it('nenhum durante a pausa, sem chave', () => {
    expect(inUseLine({ ...base, account: connected, pause: { until: at(14, 32), known: true } })).toEqual({ lead: 'Nenhum', rest: 'até 14:32.' });
  });
});

describe('chatgptView (cartão ChatGPT)', () => {
  it('desconectado com chave: pílula neutra e entrar', () => {
    const v = chatgptView({ ...base, keySaved: true });
    expect(v.pill).toEqual({ label: 'Desconectado', tone: 'muted' });
    expect(v.actions.map((a) => a.action)).toEqual(['signIn']);
  });

  it('não configurado: pílula de alerta', () => {
    const v = chatgptView(base);
    expect(v.pill).toEqual({ label: 'Não configurado', tone: 'warn' });
  });

  it('sessão expirada: entrar de novo e desconectar; sem chave na frase', () => {
    const v = chatgptView({ ...base, account: connected, attention: 'reauth', keySaved: true });
    expect(v.pill?.tone).toBe('warn');
    expect(v.actions.map((a) => a.label)).toEqual(['Entrar de novo', 'Desconectar ChatGPT']);
    expect(v.lines.some((l) => /não usa sua chave/.test(l.text))).toBe(true);
  });

  it('conta sem plano: tentar de novo', () => {
    const v = chatgptView({ ...base, account: connected, attention: 'not_eligible' });
    expect(v.actions[0]).toMatchObject({ action: 'retryPlan', label: 'Tentar de novo' });
  });

  it('limite com horário: volta às HH:MM e tentar de novo', () => {
    const v = chatgptView({ ...base, account: connected, keySaved: true, pause: { until: at(14, 32), known: true }, provider: KEY });
    expect(v.pill?.label).toBe('Limite atingido');
    expect(v.lines[0].text).toBe('Limite do plano atingido. Volta às 14:32.');
    expect(v.actions[0]).toMatchObject({ action: 'resumeChatGPT', label: 'Tentar o plano de novo' });
  });

  it('limite sem horário: nova tentativa a cada 10 min', () => {
    const v = chatgptView({ ...base, account: connected, keySaved: true, pause: { until: at(14, 42), known: false }, provider: KEY });
    expect(v.lines[0].text).toBe('Limite do plano atingido. Nova tentativa às 14:42, a cada 10 min até voltar.');
  });

  it('plano ativo: pílula ok, modelos e desconectar', () => {
    const v = chatgptView({ ...base, account: connected, provider: CHATGPT });
    expect(v.pill).toEqual({ label: 'Plano ativo', tone: 'ok' });
    expect(v.models).toBe(true);
    expect(v.actions.map((a) => a.label)).toEqual(['Desconectar ChatGPT']);
  });

  it('permissão do plano não concedida: liberar', () => {
    const v = chatgptView({ ...base, account: { ...connected, planEnabled: false } });
    expect(v.actions[0]).toMatchObject({ action: 'grant', label: 'Liberar o plano' });
  });
});

describe('shortLabel', () => {
  it('tira o complemento entre parênteses', () => {
    expect(shortLabel('NVIDIA (build.nvidia.com)')).toBe('NVIDIA');
    expect(shortLabel('Demonstração (offline)')).toBe('Demonstração');
    expect(shortLabel('OpenAI')).toBe('OpenAI');
  });
});
