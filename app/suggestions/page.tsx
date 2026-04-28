'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { useDiary, useSettings, useWeightLog, useStore } from '@/lib/useStore'
import { FoodEntry, ExerciseEntry, MEAL_LABELS, EXERCISE_LABELS } from '@/lib/types'
import { RefreshCw } from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')

type SuggestionType = 'daily' | 'weekly-diet' | 'weekly-exercise' | 'plan'

const SECTIONS: { type: SuggestionType; title: string; desc: string }[] = [
  { type: 'daily',           title: '每日建議',     desc: '根據今天飲食及運動' },
  { type: 'weekly-diet',     title: '每週飲食建議', desc: '根據本週飲食狀況' },
  { type: 'weekly-exercise', title: '每週運動建議', desc: '根據本週運動狀況' },
  { type: 'plan',            title: '達成目標計畫', desc: '根據目前進度規劃後續' },
]

function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.trim() === '') return <div key={i} className="h-2" />

    // **粗體** 處理
    const renderBold = (str: string) => {
      const parts = str.split(/\*\*(.*?)\*\*/)
      return parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)
    }

    // 數字主點：1. 2. 3. 4.
    const numMatch = line.trim().match(/^(\d+\.\s*)(.*)/)
    if (numMatch) {
      return (
        <div key={i} className="mt-4 first:mt-0">
          <p className="text-sm font-semibold text-slate-700">{renderBold(line.trim())}</p>
        </div>
      )
    }

    // 縮排子項目：*   **xxx：** yyy
    const isIndented = /^\s{2,}[\*\-]/.test(line) || /^\s{4,}/.test(line)
    const isBullet = /^\s*[\*\-]\s/.test(line)

    if (isBullet) {
      const clean = line.replace(/^\s*[\*\-]\s+/, '')
      const depth = isIndented ? 'pl-6' : 'pl-3'
      return (
        <div key={i} className={`flex gap-1.5 text-sm text-slate-600 ${depth} mt-1`}>
          <span className="flex-shrink-0 text-slate-400 mt-0.5">·</span>
          <span>{renderBold(clean)}</span>
        </div>
      )
    }

    // **備註：** 等獨立粗體行
    if (/^\*\*/.test(line.trim())) {
      return (
        <div key={i} className="mt-3 text-sm text-slate-700">
          {renderBold(line.trim())}
        </div>
      )
    }

    return (
      <div key={i} className="text-sm text-slate-600 mt-1 pl-1">{renderBold(line.trim())}</div>
    )
  })
}

export default function SuggestionsPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { diary } = useDiary()
  const { settings } = useSettings()
  const { log } = useWeightLog()
  const { suggestions: results, setSuggestions: setResults } = useStore()
  const [loading, setLoading] = useState<SuggestionType | null>(null)
  const [queue, setQueue] = useState<SuggestionType[]>([])
  const queueRef = useRef<SuggestionType[]>([])
  const isProcessing = useRef(false)
  const [errors, setErrors] = useState<Partial<Record<SuggestionType, string>>>({})

  const processQueueRef = useRef<() => Promise<void>>(async () => {})

  async function callGemini(prompt: string): Promise<string> {
    const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite']
    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
      )
      const data = await res.json()
      if (res.ok) return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const msg = data?.error?.message ?? ''
      const retryable = res.status === 503 || res.status === 429 || msg.includes('high demand') || msg.includes('quota')
      if (!retryable) throw new Error(msg)
    }
    throw new Error('所有模型目前忙碌，請稍後再試')
  }

  async function runGenerate(type: SuggestionType) {
    setErrors(prev => ({...prev, [type]: ''}))
    setLoading(type)

    // 今日資料
    const todayRec = diary.records[today]
    const todayFoods = todayRec?.foods?.length > 0
      ? todayRec.foods.map((f: FoodEntry) => `${MEAL_LABELS[f.category]}：${f.name}（${f.calories}kcal，蛋白質${f.protein}g，脂肪${f.fat}g，碳水${f.carbs}g）`).join('\n')
      : '今日尚未記錄飲食'
    const todayExercises = todayRec?.exercises?.length > 0
      ? todayRec.exercises.map((e: ExerciseEntry) => `${EXERCISE_LABELS[e.type]} ${e.minutes}分鐘（消耗${e.caloriesBurned}kcal）`).join('\n')
      : '今日尚未記錄運動'
    const todayTotalCal = todayRec?.foods?.reduce((s: number, f: FoodEntry) => s + f.calories, 0) ?? 0
    const todayBurned = todayRec?.exercises?.reduce((s: number, e: ExerciseEntry) => s + e.caloriesBurned, 0) ?? 0
    const todayWater = todayRec?.water ?? 0

    // 本週資料
    // 本週週一到週日
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=日, 1=一...6=六
    const monday = subDays(now, dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    const weekDates = Array.from({ length: 7 }, (_, i) => format(new Date(monday.getTime() + i * 86400000), 'yyyy-MM-dd'))
    const weekSummary = weekDates.map(d => {
      const r = diary.records[d]
      if (!r) return `${d}：無記錄`
      const cal = r.foods?.reduce((s: number, f: FoodEntry) => s + f.calories, 0) ?? 0
      const ex = r.exercises?.map((e: ExerciseEntry) => `${EXERCISE_LABELS[e.type]}${e.minutes}分`).join('、') || '無運動'
      return `${d}：攝取${cal}kcal，${ex}`
    }).join('\n')

    // 最新體重
    const latestWeight = log.entries[log.entries.length - 1]

    // 使用者資訊
    const userInfo = [
      settings.age ? `年齡：${settings.age}歲` : '',
      settings.gender ? `性別：${settings.gender === 'male' ? '男' : '女'}` : '',
      settings.height ? `身高：${settings.height}cm` : '',
      settings.weight ? `體重：${settings.weight}kg` : '',
      latestWeight?.weight ? `最新記錄體重：${latestWeight.weight}kg` : '',
      settings.targetWeight ? `目標體重：${settings.targetWeight}kg` : '',
      settings.dailyCalories ? `每日熱量目標：${settings.dailyCalories}kcal` : '',
      settings.bmr ? `BMR：${settings.bmr}kcal` : '',
      settings.tdee ? `TDEE：${settings.tdee}kcal` : '',
      settings.dietHabits ? `飲食習慣：${settings.dietHabits}` : '',
      settings.exerciseHabits ? `運動習慣：${settings.exerciseHabits}` : '',
      settings.goals ? `目標：${settings.goals}` : '',
    ].filter(Boolean).join('\n')

    const tone = `語氣要求：溫和、正向、客觀。不要有「您好」等開場白。若記錄為空或熱量為0，代表使用者尚未填寫當天資料，請用「尚未記錄」描述，不要假設使用者斷食或有危險行為，不要使用負面、警告或恐嚇語句。`

    const prompts: Record<SuggestionType, string> = {
      daily: `你是專業營養師兼健身教練，請根據以下資料用繁體中文給出建議，使用 markdown 格式（**粗體**、* 列表），精簡不冗長。${tone}
開頭固定寫：**以下為您的飲食與運動建議**
使用者：${userInfo}
今日飲食：${todayFoods}
今日運動：${todayExercises}
今日合計：攝取${todayTotalCal}kcal，消耗${todayBurned}kcal，喝水${todayWater}ml

請依序提供：
1. **做得好的地方：**
2. **還需補充：**
3. **明天飲食建議：**（列出午餐、晚餐、點心及目標）
4. **明天運動建議：**`,

      'weekly-diet': `你是專業營養師，請根據以下資料用繁體中文給出建議，使用 markdown 格式（**粗體**、* 列表），精簡不冗長。${tone}
開頭固定寫：**這是一份針對您本週剩餘天數的飲食建議**
使用者：${userInfo}
本週飲食記錄：
${weekSummary}

請依序提供：
1. **本週飲食表現：**
2. **需改善的地方：**
3. **具體建議（本週剩餘天數）：**（包含熱量、蛋白質、均衡飲食、少量多餐、記錄等）`,

      'weekly-exercise': `你是專業健身教練，請根據以下資料用繁體中文給出建議，使用 markdown 格式（**粗體**、* 列表），精簡不冗長。${tone}
開頭固定寫：**這是一份針對您本週剩餘天數的運動建議**
使用者：${userInfo}
本週運動記錄：
${weekSummary}

請依序提供：
1. **本週運動表現：**
2. **需改善的地方：**
3. **具體運動計畫：**（包含頻率、有氧項目、肌力訓練、強度，最後加備註）`,

      plan: `你是專業營養師兼健身教練，請根據以下資料用繁體中文給出計畫，使用 markdown 格式（**粗體**、* 列表），精簡不冗長。${tone}
開頭固定寫：**這是一份為您量身打造的減重計畫**
使用者：${userInfo}
近一週記錄：${weekSummary}

請依序提供：
1. **每週減重目標：**（建議速度）
2. **飲食關鍵調整：**（總熱量、蛋白質、碳水化合物、脂肪、蔬菜水果、飲水）
3. **運動建議：**（有氧運動、肌力訓練）
4. **預計達成時間：**（以每週減重速度估算具體週數與日期）`,
    }

    try {
      const text = await callGemini(prompts[type])
      setResults(prev => ({ ...prev, [type]: text }))  // 立刻展開
    } catch (e) {
      alert('生成失敗：' + e)
    } finally {
      setLoading(null)
    }
  }

  // processQueue 定義在 runGenerate 之後，確保可以呼叫
  processQueueRef.current = async () => {
    if (isProcessing.current) return
    while (queueRef.current.length > 0) {
      const next = queueRef.current[0]
      queueRef.current = queueRef.current.slice(1)
      setQueue([...queueRef.current])
      isProcessing.current = true
      await runGenerate(next)
      isProcessing.current = false
    }
  }

  function generate(type: SuggestionType) {
    if (!settings.geminiApiKey) {
      setErrors(prev => ({...prev, [type]: '尚未填寫 Gemini API Key，請先至設定頁面填入'}))
      return
    }
    if (queueRef.current.includes(type) || loading === type) return
    queueRef.current = [...queueRef.current, type]
    setQueue([...queueRef.current])
    processQueueRef.current()
  }

  return (
    <div className="animate-in">
      <div className="px-4 py-3">
        <p className="text-xs text-slate-400">如有個人飲食、健身習慣，可先至「設定」填寫，如此期間有調整亦可隨時更新</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {!settings.geminiApiKey && (
          <div className="card bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-700">⚠️ 請先到設定填入 Gemini API Key 才能使用 AI 功能</p>
          </div>
        )}

        {SECTIONS.map(({ type, title, desc }) => (
          <div key={type} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700">{title}</p>
                <p className="text-xs text-slate-400 truncate">{desc}</p>
              </div>
              <button onClick={() => generate(type)}
                disabled={loading === type}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-sm font-medium active:bg-brand-100 disabled:opacity-50 whitespace-nowrap">
                <RefreshCw size={13} className={loading === type ? 'animate-spin' : ''} />
                {loading === type ? '生成中…' : queue.includes(type) ? '等待中…' : results[type] ? '更新生成' : '生成'}
              </button>
            </div>

            {errors[type] && <p className="text-xs text-red-500 font-medium">{errors[type]}</p>}
            {loading === type && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <div className="w-4 h-4 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
                AI 分析中…
              </div>
            )}

            {results[type] && loading !== type && (
              <div className="bg-surface-50 rounded-xl p-3 space-y-1">
                {renderContent(results[type]!)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}