'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { useDiary, useSettings } from '@/lib/useStore'
import { ExerciseEntry, ExerciseType, EXERCISE_LABELS, EXERCISE_MET } from '@/lib/types'
import { X, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import clsx from 'clsx'

const today = format(new Date(), 'yyyy-MM-dd')
const TYPES = Object.keys(EXERCISE_LABELS) as ExerciseType[]

export default function ExercisePage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { diary, setDiary } = useDiary()
  const { settings } = useSettings()
  const [type, setType] = useState<ExerciseType>('walk')
  const [minutes, setMinutes] = useState('')
  const [customCals, setCustomCals] = useState('')
  const [customName, setCustomName] = useState('')
  const [date, setDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null)
  const [error, setError] = useState('')

  const rec = diary.records[date] ?? { date, foods: [], exercises: [], water: 0 }

  function calcCals(t: ExerciseType, mins: number) {
    return Math.round(EXERCISE_MET[t] * (settings.weight ?? 65) * (mins / 60))
  }

  async function handleRecord() {
    if (!minutes) { setError('請輸入分鐘數'); return }
    if (type === 'other' && !customName.trim()) { setError('請輸入運動名稱'); return }
    setError('')
    setLoading(true)

    let cals = customCals ? +customCals : 0
    const name = type === 'other' ? customName.trim() : EXERCISE_LABELS[type]

    // 一般運動直接算
    if (type !== 'other') {
      cals = calcCals(type, +minutes)
    }

    // 其他運動且沒填大卡 → 用 AI 估算
    if (type === 'other' && !customCals) {
      if (!settings.geminiApiKey) {
        setError('尚未填寫 API Key，請在設定頁面填入，或自行填入大卡')
        setLoading(false)
        return
      }
      try {
        const prompt = `你是專業健身教練。請估算以下運動消耗的熱量。
運動：${customName}
時間：${minutes} 分鐘
體重：${settings.weight ?? 65} kg
只回傳 JSON，格式：{"calories":數字}`
        const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite']
        for (const model of MODELS) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
          )
          const data = await res.json()
          if (res.ok) {
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            const m = text.match(/\{[\s\S]*\}/)
            if (m) { cals = JSON.parse(m[0]).calories ?? 0; break }
          }
          const msg = data?.error?.message ?? ''
          if (!(res.status === 503 || res.status === 429 || msg.includes('high demand'))) break
        }
      } catch (e) {
        setError('AI 估算失敗，已記錄為 0 kcal')
      }
    }

    const entry = {
      id: crypto.randomUUID(),
      type,
      minutes: +minutes,
      caloriesBurned: cals,
      createdAt: new Date().toISOString(),
      ...(type === 'other' ? { customName: name } : {}),
    } as ExerciseEntry & { customName?: string }

    setDiary(prev => {
      const r = prev.records[date] ?? { date, foods: [], exercises: [], water: 0 }
      return { ...prev, records: { ...prev.records, [date]: { ...r, exercises: [...r.exercises, entry] } } }
    })

    setMinutes(''); setCustomCals(''); setCustomName(''); setLoading(false)
  }

  function deleteExercise(id: string) {
    setDiary(prev => {
      const r = prev.records[date]; if (!r) return prev
      return { ...prev, records: { ...prev.records, [date]: { ...r, exercises: r.exercises.filter((e: ExerciseEntry) => e.id !== id) } } }
    })
  }

  const preview = minutes && type !== 'other' ? calcCals(type, +minutes) : null

  return (
    <div className="px-4 py-4 space-y-4 animate-in">
      <div className="card space-y-4">
        <p className="font-semibold text-slate-700">運動紀錄</p>

        {/* 運動類型 */}
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button key={t} onClick={() => { setType(t); setError(''); setCustomCals('') }}
              className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                type === t ? 'bg-brand-600 text-white' : 'bg-surface-100 text-slate-600')}>
              {EXERCISE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 記錄日期 */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">記錄日期</label>
          <div className="flex items-center gap-1">
            <button onClick={() => {
              const prev = new Date(date + 'T00:00:00'); prev.setDate(prev.getDate()-1)
              setDate(format(prev, 'yyyy-MM-dd'))
            }} className="w-7 h-9 rounded-lg bg-surface-100 flex items-center justify-center text-slate-500 text-sm active:bg-surface-200 flex-shrink-0">‹</button>
            <input type="date" className="input min-w-0 flex-1 text-sm" value={date} max={today}
              onChange={e => setDate(e.target.value)} />
            <button onClick={() => {
              const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate()+1)
              const s = format(next, 'yyyy-MM-dd'); if (s <= today) setDate(s)
            }} className="w-7 h-9 rounded-lg bg-surface-100 flex items-center justify-center text-slate-500 text-sm active:bg-surface-200 flex-shrink-0">›</button>
          </div>
        </div>

        {/* 其他：自訂名稱 */}
        {type === 'other' && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">運動名稱</label>
            <input type="text" className="input" placeholder="例：跳繩、爬樓梯、打籃球"
              value={customName} onChange={e => { setCustomName(e.target.value); setError('') }} />
          </div>
        )}

        {/* 分鐘 + 大卡 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">分鐘</label>
            <input type="number" className="input" placeholder="30"
              value={minutes} onChange={e => { setMinutes(e.target.value); setError('') }} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">
              大卡{type === 'other' ? '（選填，留空 AI 估算）' : '（選填）'}
            </label>
            <input type="number" className="input" placeholder={type === 'other' ? 'AI 自動估算' : '自動計算'}
              value={customCals} onChange={e => setCustomCals(e.target.value)} />
          </div>
        </div>

        {/* 預估提示 */}
        {preview !== null && (
          <p className="text-xs text-brand-600">預估消耗：約 {preview} kcal（體重 {settings.weight ?? 65}kg）</p>
        )}
        {type === 'other' && !customCals && minutes && customName && (
          <p className="text-xs text-slate-400">✨ 按記錄後將由 AI 自動估算消耗熱量</p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleRecord} disabled={loading}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <><Loader2 size={14} className="animate-spin" /> AI 估算中…</> : '記錄'}
        </button>
      </div>

      {/* 今日運動列表 */}
      <div>
        <p className="text-xs text-slate-400 px-1 mb-2">今日運動</p>
        {rec.exercises.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">今天還沒有運動記錄</div>
        ) : (
          rec.exercises.map((e: ExerciseEntry & { customName?: string }) => (
            <div key={e.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between border border-surface-100 mb-2">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {e.customName ?? EXERCISE_LABELS[e.type]}
                </p>
                <p className="text-xs text-slate-400">{e.minutes} 分鐘</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-brand-600">
                  {e.caloriesBurned > 0 ? `-${e.caloriesBurned} kcal` : '未知'}
                </span>
                <button onClick={() => setConfirmDeleteId(e.id)} className="p-1 text-slate-300 active:text-red-400">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          onConfirm={() => { deleteExercise(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}