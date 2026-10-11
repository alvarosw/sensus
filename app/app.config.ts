import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { ExpoConfig } from 'expo/config';

/**
 * Builds de produção não devem carregar segredos de desenvolvimento.
 * Produção = EAS_BUILD_PROFILE=production, APP_ENV=production ou NODE_ENV=production (expo export).
 */
const isProduction =
  process.env.APP_ENV === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.NODE_ENV === 'production';

export interface DevProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Lê o .env da raiz do monorepo somente em desenvolvimento.
 * Usado como fallback quando o usuário ainda não salvou um provedor no app.
 */
function readDevProvider(): DevProvider | null {
  if (isProduction) return null;
  // app/app.config.ts -> raiz do repositório/.env
  loadDotenv({ path: resolve(__dirname, '..', '.env') });
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;
  return {
    baseUrl: process.env.NVIDIA_BASE_URL ?? '',
    apiKey,
    model: process.env.NVIDIA_MODEL ?? '',
  };
}

export default (): ExpoConfig => {
  const devProvider = readDevProvider();
  return {
    name: 'Sensus',
    slug: 'sensus',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'sensus',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.sensus.app',
      supportsTablet: true,
    },
    android: {
      package: 'com.sensus.app',
      adaptiveIcon: {
        backgroundColor: '#F4F1EA',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-secure-store',
      'expo-asset',
      // MapLibre: mapas vetoriais (OpenFreeMap). Sem chave de API.
      '@maplibre/maplibre-react-native',
      [
        // Release enxuto para envio direto (limite de 30 MiB): R8 + shrinkResources,
        // libs nativas comprimidas no APK e bundle JS comprimido (sem noCompress).
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            useLegacyPackaging: true,
            enableBundleCompression: true,
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#F4F1EA',
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv: isProduction ? 'production' : 'development',
      ...(devProvider ? { devProvider } : {}),
    },
  };
};
