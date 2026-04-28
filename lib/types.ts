export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'alcohol' | 'other'

export interface FoodEntry {
  id: string
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  category: MealCategory
  createdAt: string // ISO string
}

export interface ExerciseEntry {
  id: string
  type: ExerciseType
  minutes: number
  caloriesBurned: number
  createdAt: string
}

export type ExerciseType = 'walk' | 'run' | 'bike' | 'swim' | 'weight' | 'cardio' | 'yoga' | 'other'

export interface DayRecord {
  date: string // YYYY-MM-DD
  foods: FoodEntry[]
  exercises: ExerciseEntry[]
  water: number // ml
}

export interface DiaryData {
  records: Record<string, DayRecord> // key: YYYY-MM-DD
}

export interface WeightEntry {
  date: string
  weight?: number
  bodyFat?: number
}

export interface WeightLog {
  entries: WeightEntry[]
}

export interface UserSettings {
  geminiApiKey: string
  age?: number
  gender?: 'male' | 'female'
  height?: number
  weight?: number
  targetWeight?: number
  bmr?: number
  tdee?: number
  dailyCalories?: number
  dailyProtein?: number
  dailyFat?: number
  dailyCarbs?: number
  dailyWater?: number
  dietHabits?: string
  exerciseHabits?: string
  goals?: string
}

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  walk: '走路',
  run: '慢跑',
  bike: '騎腳踏車',
  swim: '游泳',
  weight: '重訓',
  cardio: '有氧',
  yoga: '瑜伽',
  other: '其他',
}

// MET values for calorie estimation
export const EXERCISE_MET: Record<ExerciseType, number> = {
  walk: 3.5,
  run: 8.0,
  bike: 6.0,
  swim: 6.0,
  weight: 4.0,
  cardio: 7.0,
  yoga: 2.5,
  other: 4.0,
}

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
  drink: '飲料',
  alcohol: '酒精',
  other: '其他',
}
