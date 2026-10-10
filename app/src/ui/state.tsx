import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from './primitives';
import { Body, Meta } from './text';

/** Estado de carregamento/erro ocupando a tela. */
export function LoadingView({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <ActivityIndicator />
      {message ? <Meta>{message}</Meta> : null}
    </View>
  );
}

export function ErrorView({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Body>{message}</Body>
      {detail ? <Meta style={{ textAlign: 'center' }}>{detail}</Meta> : null}
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Meta>{children ?? t('common.none')}</Meta>
    </View>
  );
}
