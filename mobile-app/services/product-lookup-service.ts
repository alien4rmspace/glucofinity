import {
  nutritionCatalog,
  type ProductBarcodeLookup,
} from '@/services/nutrition-catalog';
import type { ProductBarcodeType } from '@/services/product-barcode';

export interface ProductLookupService {
  lookupBarcode(
    value: string,
    type?: ProductBarcodeType,
  ): Promise<ProductBarcodeLookup>;
}

export const localProductLookupService: ProductLookupService = {
  lookupBarcode(value, type = 'unknown') {
    return nutritionCatalog.lookupProductBarcode(value, type);
  },
};
