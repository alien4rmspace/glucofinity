import type { GlucoseInsight, InsightEvidence } from '@/types/ai';

export interface InsightExplanationRequest {
  question: string;
  insights: readonly GlucoseInsight[];
}
export interface InsightExplanation {
  text: string;
  insightIds: string[];
  providerId: string;
  model?: string;
  generatedAt: string;
}

export interface InsightLanguageProvider {
  readonly providerId: string;
  explain(request: InsightExplanationRequest): Promise<InsightExplanation>;
}

export function buildEvidenceOnlyExplanationInput(
  request: InsightExplanationRequest
): {
  question: string;
  evidence: Array<{
    insightId: string;
    title: string;
    description: string;
    evidence: InsightEvidence;
  }>;
  instructions: string[];
} {
  const question = request.question.trim();
  if (!question) throw new Error('An insight question is required.');
  if (request.insights.length === 0) {
    throw new Error('Structured evidence is required before generating an explanation.');
  }
  request.insights.forEach((insight) => {
    if (insight.evidence.sampleSize <= 0) {
      throw new Error(`Insight ${insight.id} has no supporting sample.`);
    }
  });
  return {
    question,
    evidence: request.insights.map((insight) => ({
      insightId: insight.id,
      title: insight.title,
      description: insight.description,
      evidence: insight.evidence,
    })),
    instructions: [
      'Explain only the supplied calculated evidence.',
      'Use observational and associational wording.',
      'Do not invent readings, meals, relationships, diagnoses, or treatment advice.',
      'State when the evidence is insufficient to answer the question.',
    ],
  };
}

/**
 * A deterministic development provider. It proves the evidence boundary without
 * calling an external LLM or pretending to answer beyond calculated insights.
 */
export class TemplateInsightLanguageProvider implements InsightLanguageProvider {
  readonly providerId = 'deterministic-template';

  constructor(private readonly now: () => Date = () => new Date()) {}

  async explain(request: InsightExplanationRequest): Promise<InsightExplanation> {
    const input = buildEvidenceOnlyExplanationInput(request);
    const first = input.evidence[0];
    return {
      text: `Based on the recorded data supplied to the explanation layer, ${first.description}`,
      insightIds: input.evidence.map((item) => item.insightId),
      providerId: this.providerId,
      generatedAt: this.now().toISOString(),
    };
  }
}
