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

/**
 * Opt-in explícito da chave de desenvolvimento: SENSUS_DEV_PROVIDER=1. Sem ele, nenhum build (dev ou release)
 * recebe a chave do .env. Os scripts `start`/`android`/`ios` já definem a variável; builds de release de QA
 * precisam defini-la no prebuild/gradle. Produção nunca a define. Ver docs/TESTING.md (check-apk-secrets.sh).
 */
const devProviderOptIn = process.env.SENSUS_DEV_PROVIDER === '1';

export interface DevProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * URL do manifesto dos dados de estudo, só com o opt-in de QA (SENSUS_DEV_PROVIDER=1): permite apontar um servidor
 * local no teste de ponta a ponta (ver docs/TESTING.md). Builds de produção ignoram a variável.
 */
function readDataManifestOverride(): string | null {
  if (!devProviderOptIn) return null;
  return process.env.SENSUS_DATA_MANIFEST_URL || null;
}

/**
 * Lê o .env da raiz do monorepo, somente com o opt-in SENSUS_DEV_PROVIDER=1.
 * Usado como fallback quando o usuário ainda não salvou um provedor no app.
 */
function readDevProvider(): DevProvider | null {
  if (!devProviderOptIn) return null;
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
  const dataManifestUrl = readDataManifestOverride();
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
            // Só no QA: o servidor local do teste de download é HTTP simples (Android bloqueia isso por padrão).
            ...(devProviderOptIn ? { usesCleartextTraffic: true } : {}),
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
      // Só com a chave injetada: o runtime (settings-context.tsx) exige devProviderOptIn para usá-la.
      ...(devProvider ? { devProvider, devProviderOptIn: true } : {}),
      ...(dataManifestUrl ? { dataManifestUrl } : {}),
    },
  };
};
