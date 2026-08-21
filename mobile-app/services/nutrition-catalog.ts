import { LOCAL_NUTRITION_REFERENCE_META } from '@/data/local-nutrition-reference';
import {
  estimateLocalNutrition,
  findLocalNutritionSuggestions,
} from '@/services/local-nutrition-estimator';
import type {
  LocalNutritionEstimate,
  LocalNutritionSuggestion,
} from '@/types/nutrition';
import type { ProductNutritionFacts } from '@/types/product-scoring';
import type { ProductBarcodeType } from '@/services/product-barcode';

export interface NutritionCatalogStatus {
  coreFoodCount: number;
  brandedFoodCount: number;
  brandedProductCount: number;
  brandedState: 'not-configured' | 'downloading' | 'verifying' | 'ready' | 'error';
  brandedBytesDownloaded?: number;
  brandedBytesTotal?: number;
  error?: string;
}

export interface ProductBarcodeRecord {
  productId: string;
  fdcId: number;
  gtin14: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  ingredients?: string;
  nutrition?: ProductNutritionFacts;
  publicationDate: string;
}

export type ProductBarcodeLookup =
  | { state: 'found'; product: ProductBarcodeRecord }
  | { state: 'invalid' }
  | { state: 'not-found' }
  | { state: 'catalog-preparing' }
  | { state: 'catalog-unavailable'; message?: string };

export interface NutritionCatalog {
  initialize(): Promise<NutritionCatalogStatus>;
  retryBrandedCatalog(): Promise<NutritionCatalogStatus>;
  estimate(
    foods: readonly string[],
    selectedFdcIds?: readonly (number | undefined)[],
  ): Promise<LocalNutritionEstimate>;
  findSuggestions(input: string, limit?: number): Promise<LocalNutritionSuggestion[]>;
  lookupProductBarcode(
    value: string,
    type?: ProductBarcodeType,
  ): Promise<ProductBarcodeLookup>;
}

const fallbackStatus: NutritionCatalogStatus = {
  coreFoodCount: LOCAL_NUTRITION_REFERENCE_META.foodCount,
  brandedFoodCount: 0,
  brandedProductCount: 0,
  brandedState: 'not-configured',
};

export const nutritionCatalog: NutritionCatalog = {
  async initialize() {
    return fallbackStatus;
  },
  async retryBrandedCatalog() {
    return fallbackStatus;
  },
  async estimate(foods, selectedFdcIds) {
    return estimateLocalNutrition(foods, selectedFdcIds);
  },
  async findSuggestions(input, limit = 3) {
    return findLocalNutritionSuggestions(input, limit);
  },
  async lookupProductBarcode() {
    return { state: 'catalog-unavailable' };
  },
};
