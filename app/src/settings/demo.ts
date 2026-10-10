// Quando o provedor de demonstração (offline) é o padrão.
//  - EXPO_PUBLIC_SENSUS_DEMO=1 (definido ao iniciar o Metro) força o demo, mesmo com provedor salvo
//    ou chave no .env: para capturas e testes determinísticos. Se mudar o valor, reinicie com --clear.
//  - Na web o demo é o padrão quando nada foi salvo: o CORS do navegador bloqueia a API da NVIDIA.
import { Platform } from 'react-native';

export interface DemoPolicy {
  forced: boolean;
  byDefault: boolean;
}

const forced = process.env.EXPO_PUBLIC_SENSUS_DEMO === '1';

export const DEMO_POLICY: DemoPolicy = {
  forced,
  byDefault: forced || Platform.OS === 'web',
};
