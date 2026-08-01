import type {
  Feature,
  GlucosePoint,
  Insight,
  MealEstimate,
  PostMealPoint,
  TechnologyStage,
} from "@/types/glucose";

export const dailyGlucoseData: GlucosePoint[] = [
  { time: "12 AM", glucose: 101 },
  { time: "1 AM", glucose: 98 },
  { time: "2 AM", glucose: 95 },
  { time: "3 AM", glucose: 93 },
  { time: "4 AM", glucose: 96 },
  { time: "5 AM", glucose: 100 },
  { time: "6 AM", glucose: 108 },
  { time: "7 AM", glucose: 118 },
  { time: "8 AM", glucose: 151 },
  { time: "9 AM", glucose: 162 },
  { time: "10 AM", glucose: 134 },
  { time: "11 AM", glucose: 112 },
  { time: "12 PM", glucose: 119 },
  { time: "1 PM", glucose: 155 },
  { time: "2 PM", glucose: 171 },
  { time: "3 PM", glucose: 139 },
  { time: "4 PM", glucose: 111 },
  { time: "5 PM", glucose: 103 },
  { time: "6 PM", glucose: 114 },
  { time: "7 PM", glucose: 158 },
  { time: "8 PM", glucose: 164 },
  { time: "9 PM", glucose: 141 },
  { time: "10 PM", glucose: 121 },
  { time: "11 PM", glucose: 110 },
];

export const postMealGlucoseData: PostMealPoint[] = [
  { minutes: 0, glucose: 108 },
  { minutes: 15, glucose: 121 },
  { minutes: 30, glucose: 143 },
  { minutes: 45, glucose: 161 },
  { minutes: 60, glucose: 168 },
  { minutes: 90, glucose: 149 },
  { minutes: 120, glucose: 127 },
  { minutes: 150, glucose: 112 },
  { minutes: 180, glucose: 106 },
];

export const mealEstimates: MealEstimate[] = [
  { food: "Brown rice", serving: "1 cup", carbohydrates: 45, confidence: 88 },
  { food: "Grilled salmon", serving: "4 oz", carbohydrates: 0, confidence: 94 },
  { food: "Roasted vegetables", serving: "1.5 cups", carbohydrates: 18, confidence: 82 },
];

export const features: Feature[] = [
  { title: "Continuous glucose trends", description: "See daily patterns, time in range, and meal responses in one clear timeline.", icon: "activity" },
  { title: "AI-assisted meal recognition", description: "Turn meal photos into reviewable food, serving, and carbohydrate estimates.", icon: "scan" },
  { title: "Personalized predictions", description: "Explore estimated glucose responses based on your own historical patterns.", icon: "chart" },
  { title: "Lifestyle pattern discovery", description: "Compare glucose with meals, movement, sleep, and other daily context.", icon: "sparkles" },
  { title: "Sleep and activity context", description: "Place morning and post-meal readings alongside rest and exercise events.", icon: "moon" },
  { title: "Medication logging", description: "Record medication events as context without recommending dose changes.", icon: "pill" },
  { title: "Historical summaries", description: "Review repeated responses and longer-term changes across days and weeks.", icon: "history" },
  { title: "Privacy-focused handling", description: "Designed around purposeful access, clear consent, and data minimization.", icon: "lock" },
];

export const insights: Insight[] = [
  {
    category: "Exercise timing",
    title: "A post-meal walk was associated with a gentler rise",
    description: "Across four similar rice-based meals, the observed peak was lower on days with a walk within 30 minutes.",
    context: "4 comparable meals observed",
    icon: "footprints",
  },
  {
    category: "Sleep context",
    title: "Shorter sleep may be related to higher morning readings",
    description: "Morning glucose was higher after nights with less than six hours of logged sleep in this sample period.",
    context: "12 mornings compared",
    icon: "moon",
  },
  {
    category: "Meal variability",
    title: "Similar meals produced different responses",
    description: "A repeated pattern was observed: later dinners showed a wider response range than earlier versions of the meal.",
    context: "6 dinner responses reviewed",
    icon: "utensils",
  },
  {
    category: "Repeated response",
    title: "Oatmeal responses were relatively consistent",
    description: "Three logged breakfasts had similar timing and peak ranges, with modest day-to-day variation.",
    context: "3 repeated breakfasts",
    icon: "repeat",
  },
  {
    category: "Athletic context",
    title: "Steadier pre-workout levels coincided with stronger sessions",
    description: "Within the fictional training log, more stable glucose before exercise was associated with higher self-rated performance.",
    context: "8 training sessions logged",
    icon: "dumbbell",
  },
];

export const technologyStages: TechnologyStage[] = [
  {
    label: "01 / Inputs",
    title: "Connected health context",
    description: "With user permission, planned integrations organize readings and daily events on one timeline.",
    items: ["Continuous glucose monitor data", "Apple Health data"],
    icon: "database",
  },
  {
    label: "02 / Meals",
    title: "Structured meal estimates",
    description: "A vision-language model proposes meal details, then a nutrition database supports reviewable estimates.",
    items: ["Vision-language recognition", "Structured meal data", "Nutrition lookup"],
    icon: "scan",
  },
  {
    label: "03 / Analysis",
    title: "Specialized pattern models",
    description: "Time-series prediction and models such as XGBoost can examine different parts of the response.",
    items: ["Time-series glucose prediction", "XGBoost-style pattern analysis"],
    icon: "nodes",
  },
  {
    label: "04 / Explanation",
    title: "Understandable summaries",
    description: "A planned local language model translates selected findings into cautious, plain-language explanations.",
    items: ["Local language model", "Traceable insight context"],
    icon: "message",
  },
];
