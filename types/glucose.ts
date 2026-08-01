export type GlucosePoint = {
  time: string;
  glucose: number;
};

export type PostMealPoint = {
  minutes: number;
  glucose: number;
};

export type Feature = {
  title: string;
  description: string;
  icon: string;
};

export type Insight = {
  category: string;
  title: string;
  description: string;
  context: string;
  icon: string;
};

export type MealEstimate = {
  food: string;
  serving: string;
  carbohydrates: number;
  confidence: number;
};

export type TechnologyStage = {
  label: string;
  title: string;
  description: string;
  items: string[];
  icon: string;
};
