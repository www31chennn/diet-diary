'use client'
import { useSession, signOut } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useSettings } from '@/lib/useStore'
import { calcDailyGoals } from '@/lib/calcGoals'
import { UserSettings } from '@/lib/types'
import { X, LogOut } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { settings, setSettings, loading } = useSettings()
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: keyof UserSettings, value: string | number) {
    setSettings(prev => {
      const next = {...prev, [key]: value}
      const bodyKeys = ['height', 'weight', 'age', 'gender', 'targetWeight', 'bmr', 'tdee']
      if (bodyKeys.includes(key as string)) {
        const goals = calcDailyGoals(next)
        const autoFill: Partial<UserSettings> = {}
        if (!prev.dailyCalories) autoFill.dailyCalories = goals.dailyCalories
        if (!prev.dailyProtein) autoFill.dailyProtein = goals.dailyProtein
        if (!prev.dailyFat) autoFill.dailyFat = goals.dailyFat
        if (!prev.dailyCarbs) autoFill.dailyCarbs = goals.dailyCarbs
        if (!prev.dailyWater) autoFill.dailyWater = goals.dailyWater
        if (!prev.bmr && goals.bmr) autoFill.bmr = goals.bmr
        if (!prev.tdee && goals.tdee) autoFill.tdee = goals.tdee
        return { ...next, ...autoFill }
      }
      return next
    })
  }

  function resetGoals() {
    setSettings(prev => {
      const { _summary, ...goals } = calcDailyGoals(prev) as any
      // 不覆蓋 bmr/tdee（InBody 實測值）
      return { ...prev, ...goals }
    })
  }

  // 計算說明文字
  const goalsSummary = (() => {
    if (!settings.height || !settings.weight) return null
    const goals = calcDailyGoals(settings) as any
    return goals._summary ?? null
  })()

  function saveAndClose() {
    router.push('/')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-display font-bold text-lg">個人設定</h2>
          <button onClick={() => router.push('/')} className="p-1.5 rounded-lg hover:bg-surface-100">
            <X size={18} className="text-slate-500"/>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <div className="w-4 h-4 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
              載入中...
            </div>
          )}
          {/* 使用者 */}
          {session?.user && (
            <div className="flex items-center gap-3 bg-surface-50 rounded-xl p-3">
              {session.user.image && <img src={session.user.image} alt="" className="w-9 h-9 rounded-full"/>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 text-sm truncate">{session.user.name}</p>
                <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
              </div>
              <button onClick={() => signOut({callbackUrl:'/login'})}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                <LogOut size={13}/> 登出
              </button>
            </div>
          )}

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Gemini API Key</label>
              <a href="/onboarding" className="text-xs text-brand-600 underline hover:text-brand-700">
                如何取得？
              </a>
            </div>
            <input type="password" className="input font-mono text-sm" placeholder="AIzaSy..."
              value={settings.geminiApiKey ?? ''}
              onChange={e => update('geminiApiKey', e.target.value)}
              autoComplete="off" />
            {!settings.geminiApiKey && (
              <p className="text-xs text-amber-600">⚠️ 未填寫，AI 功能將無法使用</p>
            )}
            {settings.geminiApiKey && (
              <p className="text-xs text-brand-600">✓ 已設定</p>
            )}
          </div>

          {/* 基本資料 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">基本資料</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">年齡</label>
                <input type="number" className="input" value={settings.age ?? ''}
                  onChange={e => update('age', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">性別</label>
                <div className="flex gap-1.5">
                  {(['female','male'] as const).map(g => (
                    <button key={g} onClick={() => update('gender', g)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                        ${settings.gender === g ? 'bg-brand-600 text-white' : 'bg-surface-100 text-slate-600'}`}>
                      {g === 'female' ? '女' : '男'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">身高 (cm)</label>
                <input type="number" className="input" value={settings.height ?? ''}
                  onChange={e => update('height', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">目前體重 (kg)</label>
                <input type="number" className="input" value={settings.weight ?? ''}
                  onChange={e => update('weight', +e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">目標體重 (kg)</label>
                <input type="number" className="input" value={settings.targetWeight ?? ''}
                  onChange={e => update('targetWeight', +e.target.value)} />
              </div>
            </div>
          </div>

          {/* 個人習慣 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">
              個人習慣 <span className="text-xs font-normal text-slate-400">（選填）填寫後，AI 生成建議將以此為主要參考</span>
            </p>
            {[
              {key:'dietHabits', label:'平常飲食習慣', placeholder:'例：外食為主、少吃澱粉'},
              {key:'exerciseHabits', label:'運動習慣', placeholder:'例：每週重訓 2 次、週末爬山'},
              {key:'goals', label:'想調整的飲食及運動方向', placeholder:'例：想增加蛋白質攝取、想增加更多有氧'},
            ].map(({key,label,placeholder}) => (
              <div key={key}>
                <label className="text-xs text-slate-500 block mb-1">{label}</label>
                <textarea className="input resize-none h-16 text-sm" placeholder={placeholder}
                  value={(settings[key as keyof UserSettings] as string) ?? ''}
                  onChange={e => update(key as keyof UserSettings, e.target.value)} />
              </div>
            ))}
          </div>

          {/* InBody */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">INBODY 資訊（選填）</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">BMR 基礎代謝率 (kcal)</label>
                <input type="number" className="input" placeholder="參考 InBody"
                  value={settings.bmr ?? ''} onChange={e => update('bmr', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">TDEE 每日總熱量消耗 (kcal)</label>
                <input type="number" className="input" placeholder="參考 InBody"
                  value={settings.tdee ?? ''} onChange={e => update('tdee', +e.target.value)} />
              </div>
            </div>
          </div>

          {/* 每日目標 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-surface-100 pb-2">
              <p className="text-sm font-semibold text-slate-700">每日目標</p>
              <button onClick={resetGoals}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                重新計算
              </button>
            </div>
            <p className="text-xs text-slate-400">根據身高體重自動估算，或諮詢專業後自行填寫</p>
            {goalsSummary && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <p className="text-xs text-amber-700">{goalsSummary}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                {key:'dailyCalories', label:'熱量 (kcal)', placeholder:'自動計算'},
                {key:'dailyProtein', label:'蛋白質 (g)', placeholder:'自動計算'},
                {key:'dailyFat', label:'脂肪 (g)', placeholder:'自動計算'},
                {key:'dailyCarbs', label:'碳水 (g)', placeholder:'自動計算'},
              ].map(({key,label,placeholder}) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 block mb-1">{label}</label>
                  <input type="number" className="input" placeholder={placeholder}
                    value={(settings[key as keyof UserSettings] as number) ?? ''}
                    onChange={e => update(key as keyof UserSettings, +e.target.value)} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">每日喝水目標 (ml)</label>
                <input type="number" className="input" placeholder="自動計算"
                  value={settings.dailyWater ?? ''} onChange={e => update('dailyWater', +e.target.value)} />
              </div>
            </div>
          </div>

          {/* 儲存按鈕 */}
          <button onClick={saveAndClose} className="btn-primary w-full py-3 text-base">
            儲存並開始使用
          </button>
        </div>
      </div>
    </div>
  )
}