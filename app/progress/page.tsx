'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { format, subMonths, startOfMonth, isAfter, isBefore, subDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useWeightLog, useSettings, useDiary } from '@/lib/useStore'
import { WeightEntry, FoodEntry } from '@/lib/types'
import { Pencil, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const today = format(new Date(), 'yyyy-MM-dd')
type Range = 'thisMonth' | 'lastMonth' | '1m' | '3m' | 'all' | 'custom'

export default function ProgressPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { log, setLog } = useWeightLog()
  const { settings } = useSettings()
  const { diary } = useDiary()
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [date, setDate] = useState(() => {
    return today
  })
  // 切換日期時自動帶入已有的資料
  const currentEntry = log.entries.find(e => e.date === date)

  const [range, setRange] = useState<Range>('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string|null>(null)
  const [editingEntry, setEditingEntry] = useState<WeightEntry|null>(null)

  function addEntry() {
    if (!weight && !bodyFat) return
    const entry: WeightEntry = {
      date,
      weight: weight ? +weight : undefined,
      bodyFat: bodyFat ? +bodyFat : undefined,
    }
    setLog(prev => ({
      entries: [...prev.entries.filter(e => e.date !== date), entry]
        .sort((a, b) => a.date.localeCompare(b.date))
    }))
    setWeight(''); setBodyFat('')
  }

  function deleteEntry(d: string) {
    setLog(prev => ({ entries: prev.entries.filter(e => e.date !== d) }))
  }

  function saveEdit() {
    if (!editingEntry) return
    setLog(prev => ({
      entries: prev.entries.map(e => e.date === editingEntry.date ? editingEntry : e)
    }))
    setEditingEntry(null)
  }

  const now = new Date()
  const filtered = log.entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    if (range === 'thisMonth') return d >= startOfMonth(now)
    if (range === 'lastMonth') { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d < startOfMonth(now) }
    if (range === '1m') return isAfter(d, subMonths(now, 1))
    if (range === '3m') return isAfter(d, subMonths(now, 3))
    if (range === 'custom' && customStart && customEnd) return e.date >= customStart && e.date <= customEnd
    return true
  })

  const chartData = filtered.map(e => ({
    date: e.date.slice(5),
    '體重 kg': e.weight,
    '體脂 %': e.bodyFat,
  }))

  const latest = log.entries[log.entries.length - 1]
  const targetWeight = settings.targetWeight
  const currentWeight = latest?.weight ?? settings.weight
  const diff = currentWeight && targetWeight ? Math.abs(currentWeight - targetWeight) : null
  const weeksNeeded = diff ? Math.round(diff / 0.4) : null

  // 今日記錄
  // 本週平均
  const weekEntries = log.entries.filter(e => isAfter(new Date(e.date + 'T00:00:00'), subDays(now, 7)))
  const weekDiaryEntries = Object.entries(diary.records)
    .filter(([d]) => d >= format(subDays(now, 7), 'yyyy-MM-dd'))
  const recordDays = weekDiaryEntries.filter(([, r]) => (r as any).foods?.length > 0).length
  const avgCals = recordDays > 0
    ? Math.round(weekDiaryEntries.reduce((s, [, r]) => s + (r as any).foods?.reduce((a: number, f: FoodEntry) => a + f.calories, 0), 0) / recordDays)
    : 0
  const avgProtein = recordDays > 0
    ? Math.round(weekDiaryEntries.reduce((s, [, r]) => s + (r as any).foods?.reduce((a: number, f: FoodEntry) => a + f.protein, 0), 0) / recordDays)
    : 0

  return (
    <div className="px-4 py-4 space-y-4 animate-in">

      {/* 輸入區 */}
      <div className="card">
        {/* 手機：體重體脂一行 + 日期獨行 + 按鈕獨行；電腦：全在同一行 */}
        <div className="flex flex-wrap md:flex-nowrap items-end gap-2">
          <div className="w-[calc(50%-4px)] md:flex-1">
            <label className="text-xs text-slate-500 block mb-1">體重 (kg)</label>
            <input type="number" step="0.1" className="input" placeholder="kg"
              value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
          <div className="w-[calc(50%-4px)] md:flex-1">
            <label className="text-xs text-slate-500 block mb-1">體脂率 (%)</label>
            <input type="number" step="0.1" className="input" placeholder="%"
              value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
          </div>
          <div className="w-full md:flex-1">
            <label className="text-xs text-slate-500 block mb-1">日期</label>
            <div className="flex items-center gap-1">
              <button onClick={() => {
                const prev = new Date(date + 'T00:00:00'); prev.setDate(prev.getDate()-1)
                setDate(format(prev,'yyyy-MM-dd'))
              }} className="w-7 h-9 rounded-lg bg-surface-100 flex items-center justify-center text-slate-500 text-sm active:bg-surface-200 flex-shrink-0">‹</button>
              <input type="date" className="input text-sm" value={date} max={today}
                onChange={e => { setDate(e.target.value); const entry = log.entries.find(x => x.date === e.target.value); setWeight(entry?.weight?.toString() ?? ''); setBodyFat(entry?.bodyFat?.toString() ?? '') }} />
              <button onClick={() => {
                const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate()+1)
                const s = format(next,'yyyy-MM-dd'); if (s <= today) { setDate(s); const entry = log.entries.find(x => x.date === s); setWeight(entry?.weight?.toString() ?? ''); setBodyFat(entry?.bodyFat?.toString() ?? '') }
              }} className="w-7 h-9 rounded-lg bg-surface-100 flex items-center justify-center text-slate-500 text-sm active:bg-surface-200 flex-shrink-0">›</button>
            </div>
          </div>
          <button onClick={addEntry} disabled={!weight && !bodyFat}
            className="btn-primary w-full md:w-auto px-6 py-2.5 disabled:opacity-50 flex-shrink-0">
            記錄
          </button>
        </div>
      </div>

      {/* 當日記錄 */}
      {currentEntry && (
        <div className="card">
          <p className="text-xs text-slate-400 mb-2">{date === today ? '今日記錄' : `${date} 記錄`}</p>
          <div className="bg-surface-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              {currentEntry.weight && <p className="text-sm font-medium text-slate-700">體重 {currentEntry.weight} kg</p>}
              {currentEntry.bodyFat && <p className="text-sm text-slate-500">體脂率 {currentEntry.bodyFat} %</p>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditingEntry({...currentEntry})} className="p-1.5 text-slate-300 active:text-slate-500">
                <Pencil size={13}/>
              </button>
              <button onClick={() => setConfirmDeleteDate(currentEntry.date)} className="p-1.5 text-slate-300 active:text-red-400">
                <X size={14}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Range 選擇 */}
      <div className="flex flex-wrap gap-1.5">
        {([
          ['thisMonth','本月'], ['lastMonth','上月'], ['1m','近1個月'],
          ['3m','近3個月'], ['all','全部'], ['custom','自選']
        ] as [Range, string][]).map(([r, l]) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${range === r ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-surface-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="flex gap-2 items-center">
          <input type="date" className="input flex-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <span className="text-slate-400">~</span>
          <input type="date" className="input flex-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
        </div>
      )}

      {/* 圖表 */}
      {chartData.length > 1 ? (
        <div className="card">
          <p className="text-xs text-slate-400 mb-3">體重 & 體脂趨勢</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
              <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="體重 kg" stroke="#5B8DB8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="體脂 %" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card text-center py-8 text-slate-400 text-sm">
          記錄 2 筆以上才會顯示圖表
        </div>
      )}

      {/* 目標進度 */}
      <div className="card space-y-2.5">
        <p className="text-xs text-slate-400 mb-1">目標進度</p>
        {[
          { label: '目前體重', val: currentWeight ? `${currentWeight} kg` : '未記錄' },
          { label: '目標體重', val: targetWeight ? `${targetWeight} kg` : '未設定' },
          { label: '還需減', val: diff ? `${diff.toFixed(1)} kg` : '—' },
          { label: '預計達成', val: weeksNeeded ? `約 ${weeksNeeded} 週（${Math.round(weeksNeeded / 4)} 個月）` : '—' },
          { label: '目前體脂', val: latest?.bodyFat ? `${latest.bodyFat} %` : '未記錄' },
          { label: '每日熱量目標', val: settings.dailyCalories ? `${settings.dailyCalories} kcal` : '未設定' },
          { label: '基礎代謝率', val: settings.bmr ? `${settings.bmr} kcal` : settings.height && settings.weight ? `${Math.round(10 * settings.weight + 6.25 * settings.height - 5 * (settings.age ?? 25) - 161)} kcal（估算）` : '未設定' },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-700 font-medium">{val}</span>
          </div>
        ))}
      </div>

      {/* 本週平均 */}
      <div className="card space-y-2.5">
        <p className="text-xs text-slate-400 mb-1">本週平均</p>
        {[
          { label: '記錄天數', val: `${recordDays} 天` },
          { label: '平均熱量', val: avgCals ? `${avgCals} kcal` : '無資料' },
          { label: '平均蛋白質', val: avgProtein ? `${avgProtein} g` : '無資料' },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-700 font-medium">{val}</span>
          </div>
        ))}
      </div>

      {/* 確認刪除 */}
      {confirmDeleteDate && (
        <ConfirmDialog
          onConfirm={() => { deleteEntry(confirmDeleteDate); setConfirmDeleteDate(null) }}
          onCancel={() => setConfirmDeleteDate(null)}
        />
      )}

      {/* 編輯 modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setEditingEntry(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">編輯記錄</h3>
              <button onClick={() => setEditingEntry(null)} className="p-1.5 rounded-lg hover:bg-surface-100">
                <X size={18} className="text-slate-400"/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">體重 (kg)</label>
                <input type="number" step="0.1" className="input"
                  value={editingEntry.weight ?? ''}
                  onChange={e => setEditingEntry(p => p ? {...p, weight: +e.target.value} : p)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">體脂率 (%)</label>
                <input type="number" step="0.1" className="input"
                  value={editingEntry.bodyFat ?? ''}
                  onChange={e => setEditingEntry(p => p ? {...p, bodyFat: +e.target.value} : p)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingEntry(null)}
                className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-500">取消</button>
              <button onClick={saveEdit} className="flex-1 btn-primary py-2.5">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}