'use client'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Settings, X, ExternalLink, Key, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { useSettings, useStore } from '@/lib/useStore'
import { UserSettings } from '@/lib/types'
import { calcDailyGoals } from '@/lib/calcGoals'
import { useState } from 'react'
import { signOut } from 'next-auth/react'

const TABS = [
  { href: '/',            label: '飲食' },
  { href: '/exercise',    label: '運動' },
  { href: '/calendar',    label: '日曆' },
  { href: '/progress',    label: '目標' },
  { href: '/suggestions', label: '建議' },
]

const NO_SHELL = ['/login']

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { settings, setSettings } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [apiKey, setApiKey] = useState('')

  if (NO_SHELL.some(p => pathname.startsWith(p))) {
    return <>{children}</>
  }

  // Intercept /settings and /onboarding navigation → show modal instead
  const isSettingsPage = pathname === '/settings'
  const isOnboardingPage = pathname.startsWith('/onboarding')

  function update(key: keyof UserSettings, value: string | number) {
    // 數字欄位：空字串時存 undefined，避免 0 卡住
    const textKeys = ['geminiApiKey', 'dietHabits', 'exerciseHabits', 'goals', 'gender']
    const parsed = textKeys.includes(key as string)
      ? value
      : (value === '' || value === 0 ? undefined : +value)
    setSettings(prev => ({ ...prev, [key]: parsed }))
  }

  function resetGoals() {
    setSettings(prev => {
      const { _summary, ...goals } = calcDailyGoals(prev) as any
      return { ...prev, ...goals }
    })
  }

  const goalsSummary = (() => {
    if (!settings.height || !settings.weight) return null
    const goals = calcDailyGoals(settings) as any
    return goals._summary ?? null
  })()

  const today = format(new Date(), 'M月d日 EEEE', { locale: zhTW })

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      {/* 頂部 Header */}
      <header className="border-b border-surface-100 sticky top-0 z-20 pt-safe backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-base">🥗</div>
            <div>
              <p className="font-display font-bold text-slate-800 text-sm leading-tight">Diet Diary</p>
              <p className="text-[10px] text-slate-400 leading-tight">飲食日記</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:block">{today}</span>
            <button onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-100 transition-colors">
              <Settings size={15} className="text-slate-500" />
            </button>
          </div>
        </div>
        <div className="px-3 pb-2.5">
          <div className="flex bg-surface-100 rounded-xl p-1 gap-0.5">
            {TABS.map(({ href, label }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href}
                  className={clsx(
                    'flex-1 text-center text-sm font-medium py-1.5 rounded-lg transition-all',
                    active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}>
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {/* 主要內容 - settings/onboarding 以 modal 呈現，children 始終渲染 */}
      <main className="flex-1 pb-safe">
        {children}
      </main>

      {/* Settings Modal */}
      {(showSettings || isSettingsPage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => { setShowSettings(false); if (isSettingsPage) router.back() }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-display font-bold text-lg">個人設定</h2>
              <button onClick={() => { setShowSettings(false); if (isSettingsPage) router.push('/') }}
                className="p-1.5 rounded-lg hover:bg-surface-100">
                <X size={18} className="text-slate-500"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Gemini API Key</label>
                  <button onClick={() => { setShowSettings(false); setShowOnboarding(true) }}
                    className="text-xs text-brand-600 underline hover:text-brand-700">如何取得？</button>
                </div>
                <input type="password" className="input font-mono text-sm" placeholder="AIzaSy..."
                  value={settings.geminiApiKey ?? ''} autoComplete="off"
                  onChange={e => update('geminiApiKey', e.target.value)} />
                {!settings.geminiApiKey
                  ? <p className="text-xs text-amber-600">⚠️ 未填寫，AI 功能將無法使用</p>
                  : <p className="text-xs text-brand-600">✓ 已設定</p>}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">基本資料</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500 block mb-1">年齡</label>
                    <input type="number" className="input" value={settings.age ?? ''} onChange={e => update('age', e.target.value)} /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">性別</label>
                    <div className="flex gap-1.5">
                      {(['female','male'] as const).map(g => (
                        <button key={g} onClick={() => update('gender', g)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${settings.gender === g ? 'bg-brand-600 text-white' : 'bg-surface-100 text-slate-600'}`}>
                          {g === 'female' ? '女' : '男'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><label className="text-xs text-slate-500 block mb-1">身高 (cm)</label>
                    <input type="number" className="input" value={settings.height ?? ''} onChange={e => update('height', e.target.value)} /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">目前體重 (kg)</label>
                    <input type="number" className="input" value={settings.weight ?? ''} onChange={e => update('weight', e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">目標體重 (kg)</label>
                    <input type="number" className="input" value={settings.targetWeight ?? ''} onChange={e => update('targetWeight', e.target.value)} /></div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">個人習慣 <span className="text-xs font-normal text-slate-400">（選填）</span></p>
                {[
                  {key:'dietHabits', label:'平常飲食習慣', placeholder:'例：外食為主、少吃澱粉'},
                  {key:'exerciseHabits', label:'運動習慣', placeholder:'例：每週重訓 2 次'},
                  {key:'goals', label:'目標方向', placeholder:'例：想增加蛋白質攝取'},
                ].map(({key,label,placeholder}) => (
                  <div key={key}><label className="text-xs text-slate-500 block mb-1">{label}</label>
                    <textarea className="input resize-none h-14 text-sm" placeholder={placeholder}
                      value={(settings[key as keyof UserSettings] as string) ?? ''}
                      onChange={e => update(key as keyof UserSettings, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 border-b border-surface-100 pb-2">INBODY 資訊（選填）</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500 block mb-1">BMR (kcal)</label>
                    <input type="number" className="input" placeholder="參考 InBody" value={settings.bmr ?? ''} onChange={e => update('bmr', e.target.value)} /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">TDEE (kcal)</label>
                    <input type="number" className="input" placeholder="參考 InBody" value={settings.tdee ?? ''} onChange={e => update('tdee', e.target.value)} /></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-surface-100 pb-2">
                  <p className="text-sm font-semibold text-slate-700">每日目標</p>
                  <button onClick={resetGoals} className="text-xs text-brand-600 hover:text-brand-700 font-medium">重新計算</button>
                </div>
                <p className="text-xs text-slate-400">根據身高體重自動估算，或諮詢專業後自行填寫</p>
                {goalsSummary && <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><p className="text-xs text-amber-700">{goalsSummary}</p></div>}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {key:'dailyCalories',label:'熱量 (kcal)',placeholder:'自動計算'},
                    {key:'dailyProtein',label:'蛋白質 (g)',placeholder:'自動計算'},
                    {key:'dailyFat',label:'脂肪 (g)',placeholder:'自動計算'},
                    {key:'dailyCarbs',label:'碳水 (g)',placeholder:'自動計算'},
                  ].map(({key,label,placeholder}) => (
                    <div key={key}><label className="text-xs text-slate-500 block mb-1">{label}</label>
                      <input type="number" className="input" placeholder={placeholder}
                        value={(settings[key as keyof UserSettings] as number) ?? ''}
                        onChange={e => update(key as keyof UserSettings, e.target.value === '' ? '' : +e.target.value)} /></div>
                  ))}
                  <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">每日喝水目標 (ml)</label>
                    <input type="number" className="input" placeholder="自動計算"
                      value={settings.dailyWater ?? ''} onChange={e => update('dailyWater', e.target.value)} /></div>
                </div>
              </div>
              <button onClick={() => {
                // 儲存時，沒有填的每日目標才自動計算
                setSettings(prev => {
                  const { _summary, ...goals } = calcDailyGoals(prev) as any
                  const autoFill: Partial<UserSettings> = {}
                  if (!prev.dailyCalories && goals.dailyCalories) autoFill.dailyCalories = goals.dailyCalories
                  if (!prev.dailyProtein && goals.dailyProtein) autoFill.dailyProtein = goals.dailyProtein
                  if (!prev.dailyFat && goals.dailyFat) autoFill.dailyFat = goals.dailyFat
                  if (!prev.dailyCarbs && goals.dailyCarbs) autoFill.dailyCarbs = goals.dailyCarbs
                  if (!prev.dailyWater && goals.dailyWater) autoFill.dailyWater = goals.dailyWater
                  return { ...prev, ...autoFill }
                })
                setShowSettings(false)
                if (isSettingsPage) router.push('/')
              }} className="btn-primary w-full py-3 text-base">儲存並關閉</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {(showOnboarding || isOnboardingPage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => { localStorage.setItem('onboarding_seen','1'); setShowOnboarding(false); if (isOnboardingPage) router.back() }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
              <h2 className="font-display font-bold text-lg">如何取得 API Key</h2>
              <button onClick={() => { localStorage.setItem('onboarding_seen','1'); setShowOnboarding(false); if (isOnboardingPage) router.back() }}
                className="p-1.5 rounded-lg hover:bg-surface-100"><X size={18} className="text-slate-400"/></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="bg-surface-50 rounded-xl p-4 space-y-3">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                  className="flex items-center justify-between text-sm font-medium text-blue-600 hover:text-blue-700">
                  前往 Google AI Studio 申請 <ExternalLink size={14}/>
                </a>
                <div className="space-y-2 text-sm text-slate-500">
                  {['用 Google 帳號登入','點「Create API Key」，選擇專案','複製產生的 Key（AIza 開頭）貼到設定'].map((s,i) => (
                    <div key={i} className="flex gap-2">
                      <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold flex-shrink-0">{i+1}</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600">💡 每日免費 500 次，超過自動暫停，不會產生費用</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Key size={14}/> 貼上你的 API Key
                </label>
                <input type="password" className="input font-mono text-sm" placeholder="AIzaSy..."
                  value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off"/>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { localStorage.setItem('onboarding_seen','1'); setShowOnboarding(false); if (isOnboardingPage) router.back() }}
                  className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-500">跳過</button>
                <button onClick={async () => {
                  localStorage.setItem('onboarding_seen','1')
                  if (apiKey.trim()) {
                    update('geminiApiKey', apiKey.trim())
                  }
                  setShowOnboarding(false)
                  setApiKey('')
                  if (isOnboardingPage) router.push('/')
                }} className="flex-1 btn-primary py-2.5">
                  {apiKey.trim() ? '確認儲存' : '先跳過'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
