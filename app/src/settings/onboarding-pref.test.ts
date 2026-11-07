import { describe, expect, it } from 'vitest';
import { shouldShowOnboarding } from './onboarding-pref';

describe('quem vê a apresentação', () => {
  it('instalação nova (sem preferências gravadas): sim', () => {
    expect(shouldShowOnboarding({ hasStoredPrefs: false, onboardingDone: undefined })).toBe(true);
  });

  it('preferências gravadas sem a chave (quem já usava o app): não', () => {
    expect(shouldShowOnboarding({ hasStoredPrefs: true, onboardingDone: undefined })).toBe(false);
  });

  it('com a chave gravada, vale a chave', () => {
    expect(shouldShowOnboarding({ hasStoredPrefs: true, onboardingDone: false })).toBe(true);
    expect(shouldShowOnboarding({ hasStoredPrefs: true, onboardingDone: true })).toBe(false);
  });
});
