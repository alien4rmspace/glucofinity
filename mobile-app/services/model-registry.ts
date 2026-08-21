import type { ModelMetadata } from '@/types/ai';
import { validateModelMetadata } from './model-validation';

export interface ModelRegistry {
  register(metadata: ModelMetadata): void;
  get(modelId: string, version: string): ModelMetadata | undefined;
  list(modelId?: string): ModelMetadata[];
}
function key(modelId: string, version: string): string {
  return `${modelId}@${version}`;
}

export class InMemoryModelRegistry implements ModelRegistry {
  private readonly entries = new Map<string, ModelMetadata>();

  register(metadata: ModelMetadata): void {
    const validated = validateModelMetadata(metadata);
    const registryKey = key(validated.modelId, validated.version);
    if (this.entries.has(registryKey)) {
      throw new Error(`Model ${registryKey} is already registered.`);
    }
    this.entries.set(registryKey, validated);
  }

  get(modelId: string, version: string): ModelMetadata | undefined {
    return this.entries.get(key(modelId, version));
  }

  list(modelId?: string): ModelMetadata[] {
    return [...this.entries.values()]
      .filter((metadata) => modelId === undefined || metadata.modelId === modelId)
      .sort((first, second) =>
        `${first.modelId}@${first.version}`.localeCompare(
          `${second.modelId}@${second.version}`
        )
      );
  }
}
