import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { nutritionCatalog } from '@/services/nutrition-catalog';

export function NutritionCatalogProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    void nutritionCatalog.initialize().catch(() => {
      // Searches retry initialization and surface unresolved foods for review.
      // The catalog never blocks the rest of the app from opening.
    });
  }, []);

  return children;
}
