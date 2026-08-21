export interface AppVersionInfo {
  version: string;
  build: string;
}

interface ResolveAppVersionInput {
  nativeVersion: string | null;
  nativeBuild: string | null;
  configuredVersion?: string;
  configuredBuild?: string | number;
}

export function resolveAppVersionInfo({
  nativeVersion,
  nativeBuild,
  configuredVersion,
  configuredBuild,
}: ResolveAppVersionInput): AppVersionInfo {
  return {
    version: nativeVersion ?? configuredVersion ?? 'Unavailable',
    build: nativeBuild ?? String(configuredBuild ?? 'Unavailable'),
  };
}
