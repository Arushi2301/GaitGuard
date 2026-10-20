export type BmiKey = 'underweight' | 'normal' | 'overweight' | 'obese';

export type BmiCategory = { key: BmiKey; label: string; range: string };

// WHO adult BMI ranges. Returns null for anything that is not a positive, finite number.
export function getBmiCategory(bmi: number): BmiCategory | null {
  if (typeof bmi !== 'number' || !Number.isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return { key: 'underweight', label: 'Underweight', range: 'below 18.5' };
  if (bmi < 25) return { key: 'normal', label: 'Normal weight', range: '18.5–24.9' };
  if (bmi < 30) return { key: 'overweight', label: 'Overweight', range: '25.0–29.9' };
  return { key: 'obese', label: 'Obese', range: '30.0 and above' };
}
