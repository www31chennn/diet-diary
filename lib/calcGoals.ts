import { UserSettings } from './types'

// Mifflin-St Jeor 公式（目前最準確的 BMR 公式）
export function calcBMR(settings: UserSettings): number {
  const { age, gender, height, weight } = settings
  if (!height || !weight) return 0
  const base = 10 * weight + 6.25 * height - 5 * (age ?? 25)
  return Math.round((gender === 'female' ? base - 161 : base + 5) * 100) / 100
}

// TDEE：BMR × 1.375（輕度活動）
export function calcTDEE(bmr: number): number {
  return Math.round(bmr * 1.375 * 100) / 100
}

// 根據目標計算每日熱量
function calcDailyCalories(tdee: number, weight?: number, targetWeight?: number): number {
  if (!targetWeight || !weight) return Math.round(tdee)
  if (targetWeight < weight) return Math.round(tdee * 0.8)  // 減脂：TDEE × 80%
  if (targetWeight > weight) return Math.round(tdee * 1.1)  // 增肌：TDEE × 110%
  return Math.round(tdee)
}

// 完整計算每日目標
// 注意：bmr/tdee 欄位是 InBody 實測值，不由此函式填入
export function calcDailyGoals(settings: UserSettings): Partial<UserSettings> & { _summary?: string } {
  // 優先用 InBody 實測值，沒有才用公式估算
  const bmrCalc = calcBMR(settings)
  if (!bmrCalc) return {}

  const bmrUsed = settings.bmr || bmrCalc        // InBody > 公式
  const tdeeUsed = settings.tdee || calcTDEE(bmrUsed)  // InBody > 公式

  const weight = settings.weight ?? 65
  const targetWeight = settings.targetWeight
  const dailyCalories = calcDailyCalories(tdeeUsed, weight, targetWeight)

  // 蛋白質：體重 × 1.8g
  const dailyProtein = Math.round(weight * 1.8)

  // 脂肪：總熱量 25%
  const dailyFat = Math.round((dailyCalories * 0.25) / 9)

  // 碳水：剩餘熱量
  const dailyCarbs = Math.max(0, Math.round((dailyCalories - dailyProtein * 4 - dailyFat * 9) / 4))

  // 喝水：體重 × 33ml
  const dailyWater = Math.round(weight * 33)

  // 說明文字
  const goalType = !targetWeight ? '維持' : targetWeight < weight ? '減脂目標' : '增肌目標'
  const bmrLabel = settings.bmr ? `BMR ${settings.bmr}（InBody）` : `BMR ${bmrCalc}（估算）`
  const tdeeLabel = settings.tdee ? `TDEE ${settings.tdee}（InBody）` : `TDEE ${Math.round(tdeeUsed)}`
  const _summary = `${bmrLabel} → ${tdeeLabel} kcal → ${goalType} ${dailyCalories} kcal`

  // 不回傳 bmr/tdee，讓使用者自己填 InBody 值
  return { dailyCalories, dailyProtein, dailyFat, dailyCarbs, dailyWater, _summary }
}