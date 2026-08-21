export interface RemoteNutritionCatalogConfig {
  url: string;
  version: string;
  md5: string;
  bytes: number;
}

export function remoteNutritionCatalogConfig(): RemoteNutritionCatalogConfig | undefined {
  const url = process.env.EXPO_PUBLIC_FOOD_CATALOG_URL?.trim();
  const version = process.env.EXPO_PUBLIC_FOOD_CATALOG_VERSION?.trim();
  const md5 = process.env.EXPO_PUBLIC_FOOD_CATALOG_MD5?.trim().toLocaleLowerCase();
  const byteText = process.env.EXPO_PUBLIC_FOOD_CATALOG_BYTES?.trim();
  if (!url && !version && !md5 && !byteText) return undefined;
  if (!url || !version || !md5 || !byteText) {
    throw new Error(
      'The branded food catalog requires URL, version, byte size, and MD5 environment values.',
    );
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error('The branded food catalog URL must use HTTPS.');
  }
  if (!/^[a-f0-9]{32}$/.test(md5)) {
    throw new Error('The branded food catalog MD5 must contain 32 hexadecimal characters.');
  }
  if (!/^[a-z0-9._-]+$/i.test(version)) {
    throw new Error('The branded food catalog version contains unsupported characters.');
  }
  const bytes = Number(byteText);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('The branded food catalog byte size must be a positive integer.');
  }
  return { url, version, md5, bytes };
}
