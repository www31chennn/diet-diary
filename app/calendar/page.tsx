'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useDiary, useWeightLog, useSettings } from '@/lib/useStore'
import { FoodEntry, ExerciseEntry, EXERCISE_LABELS, MEAL_LABELS } from '@/lib/types'
import { ChevronLeft, ChevronRight, X, Pencil } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function CalendarPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { diary, setDiary } = useDiary()
  const [editingFood, setEditingFood] = useState<FoodEntry|null>(null)
  const [confirmDeleteFoodId, setConfirmDeleteFoodId] = useState<string|null>(null)
  const [confirmDeleteExerciseId, setConfirmDeleteExerciseId] = useState<string|null>(null)
  const { log } = useWeightLog()
  const { settings } = useSettings()
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(format(new Date(), 'yyyy-MM-dd'))

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const firstDay = getDay(startOfMonth(current))
  const selectedRecord = diary.records[selected]
  const selectedWeight = log.entries.find(e => e.date === selected)

  const totalCals = selectedRecord?.foods?.reduce((s: number, f: FoodEntry) => s + f.calories, 0) ?? 0
  const totalBurned = selectedRecord?.exercises?.reduce((s: number, e: ExerciseEntry) => s + e.caloriesBurned, 0) ?? 0
  const totalProtein = selectedRecord?.foods?.reduce((s: number, f: FoodEntry) => s + f.protein, 0) ?? 0
  const totalFat = selectedRecord?.foods?.reduce((s: number, f: FoodEntry) => s + f.fat, 0) ?? 0
  const totalCarbs = selectedRecord?.foods?.reduce((s: number, f: FoodEntry) => s + f.carbs, 0) ?? 0

  function deleteFood(id: string) {
    setDiary(prev => {
      const rec = prev.records[selected]
      if (!rec) return prev
      return { ...prev, records: { ...prev.records, [selected]: { ...rec, foods: rec.foods.filter((f: FoodEntry) => f.id !== id) } } }
    })
  }

  function deleteExercise(id: string) {
    setDiary(prev => {
      const rec = prev.records[selected]
      if (!rec) return prev
      return { ...prev, records: { ...prev.records, [selected]: { ...rec, exercises: rec.exercises.filter((e: ExerciseEntry) => e.id !== id) } } }
    })
  }

  function saveEdit(updated: FoodEntry) {
    setDiary(prev => {
      const rec = prev.records[selected]
      if (!rec) return prev
      return { ...prev, records: { ...prev.records, [selected]: {
        ...rec,
        foods: rec.foods.map((f: FoodEntry) => f.id === updated.id ? updated : f)
      }}}
    })
    setEditingFood(null)
  }

  const goalCals = settings.dailyCalories ?? 1800
  const goalProtein = settings.dailyProtein ?? 60
  const goalFat = settings.dailyFat ?? 60
  const goalCarbs = settings.dailyCarbs ?? 225
  const goalWater = settings.dailyWater ?? 2000

  const selectedDateLabel = format(new Date(selected + 'T00:00:00'), 'yyyy年M月d日 EEEE', { locale: zhTW })

  return (
    <div className="px-4 py-4 space-y-4 animate-in">
      {/* 月曆 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1))}
            className="p-2 rounded-xl active:bg-surface-100"><ChevronLeft size={18} /></button>
          <span className="font-semibold text-slate-700">
            {format(current, 'yyyy年 M月', { locale: zhTW })}
          </span>
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1))}
            className="p-2 rounded-xl active:bg-surface-100"><ChevronRight size={18} /></button>
        </div>

        <div className="flex gap-3 justify-end mb-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />飲食</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />運動</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />體重/體脂</span>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
            <div key={d} className="text-center text-xs text-slate-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const rec = diary.records[key]
            const hasFoods = (rec?.foods?.length ?? 0) > 0
            const hasEx = (rec?.exercises?.length ?? 0) > 0
            const hasWeight = log.entries.some(e => e.date === key)
            const active = selected === key
            const todayDay = isToday(day)
            return (
              <button key={key} onClick={() => setSelected(key)}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-colors
                  ${active ? 'bg-brand-600' : todayDay ? 'bg-brand-50' : 'active:bg-surface-50'}`}>
                <span className={`text-sm font-medium ${active ? 'text-white' : todayDay ? 'text-brand-600' : 'text-slate-700'}`}>
                  {day.getDate()}
                </span>
                <div className="flex gap-0.5 mt-0.5 h-1.5">
                  {hasFoods && <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/70' : 'bg-brand-500'}`} />}
                  {hasEx && <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/70' : 'bg-amber-400'}`} />}
                  {hasWeight && <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/70' : 'bg-rose-400'}`} />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 選中日期詳細 */}
      <div className="card space-y-4">
        <p className="font-semibold text-slate-700">{selectedDateLabel}</p>

        {/* 飲食 */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">飲食</p>
          {!selectedRecord?.foods?.length ? (
            <p className="text-sm text-slate-300 py-1">無飲食記錄</p>
          ) : (
            <div className="space-y-2">
              {selectedRecord.foods.map((f: FoodEntry) => (
                <div key={f.id} className="bg-surface-50 rounded-xl px-3 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 mb-0.5">
                      {MEAL_LABELS[f.category]} · {new Date(f.createdAt).toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit', timeZone:'Asia/Taipei'})}
                    </p>
                    <p className="text-sm font-medium text-slate-700 break-words">{f.name}</p>
                  </div>
                  <div className="flex gap-3 flex-shrink-0 self-center">
                    {([
                      {val: f.calories, label: 'kcal', color: 'text-brand-600'},
                      {val: `${f.protein}g`, label: '蛋白', color: 'text-purple-400'},
                      {val: `${f.fat}g`, label: '脂肪', color: 'text-amber-500'},
                      {val: `${f.carbs}g`, label: '碳水', color: 'text-amber-400'},
                    ] as const).map(({val, label, color}) => (
                      <div key={label} className="text-center">
                        <p className={`text-xs font-semibold leading-none ${color}`}>{val}</p>
                        <p className="text-[10px] text-slate-400 leading-none mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-0 flex-shrink-0 self-center">
                    <button onClick={() => setEditingFood({...f})}
                      className="p-1 text-slate-300 active:text-slate-500">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setConfirmDeleteFoodId(f.id)}
                      className="p-1 text-slate-300 active:text-red-400">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 運動 */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">運動</p>
          {!selectedRecord?.exercises?.length ? (
            <p className="text-sm text-slate-300 py-1">這天沒有運動記錄</p>
          ) : (
            <div className="space-y-1.5">
              {selectedRecord.exercises.map((e: ExerciseEntry & { customName?: string }) => (
                <div key={e.id} className="flex items-center justify-between bg-surface-50 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {e.customName ?? EXERCISE_LABELS[e.type]}
                    </p>
                    <p className="text-xs text-slate-400">{e.minutes} 分鐘</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-500">-{e.caloriesBurned} kcal</span>
                    <button onClick={() => setConfirmDeleteExerciseId(e.id)}
                      className="p-1.5 text-slate-300 active:text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 當日總覽 */}
        <div className="bg-surface-50 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-semibold text-slate-500 mb-3">當日總覽</p>
          {[
            { label: '熱量', val: `${totalCals} / ${goalCals} kcal`, warn: totalCals < goalCals * 0.5 && totalCals > 0 },
            { label: '蛋白質', val: `${Math.round(totalProtein)} / ${goalProtein} g` },
            { label: '脂肪', val: `${Math.round(totalFat)} / ${goalFat} g` },
            { label: '碳水', val: `${Math.round(totalCarbs)} / ${goalCarbs} g` },
            {
              label: '喝水',
              val: selectedRecord?.water ? `${selectedRecord.water} / ${goalWater} ml` : `0 / ${goalWater} ml 未達標`,
              warn: !selectedRecord?.water || selectedRecord.water < goalWater
            },
            { label: '運動消耗', val: totalBurned ? `-${totalBurned} kcal` : '無記錄' },
            { label: '運動', val: selectedRecord?.exercises?.length
              ? selectedRecord.exercises.map((e: ExerciseEntry & { customName?: string }) =>
                  `${e.customName ?? EXERCISE_LABELS[e.type]}(${e.minutes}分)`).join('、')
              : '無記錄'
            },
            { label: '體重', val: selectedWeight?.weight ? `${selectedWeight.weight} kg` : '無記錄' },
            { label: '體脂率', val: selectedWeight?.bodyFat ? `${selectedWeight.bodyFat} %` : '無記錄' },
          ].map(({ label, val, warn }) => (
            <div key={label} className="flex justify-between items-start text-sm gap-2">
              <span className="text-slate-400 flex-shrink-0">{label}</span>
              <span className={`text-right ${warn ? 'text-amber-500' : 'text-slate-700 font-medium'}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {confirmDeleteFoodId && (
        <ConfirmDialog
          onConfirm={() => { deleteFood(confirmDeleteFoodId); setConfirmDeleteFoodId(null) }}
          onCancel={() => setConfirmDeleteFoodId(null)}
        />
      )}
      {confirmDeleteExerciseId && (
        <ConfirmDialog
          onConfirm={() => { deleteExercise(confirmDeleteExerciseId); setConfirmDeleteExerciseId(null) }}
          onCancel={() => setConfirmDeleteExerciseId(null)}
        />
      )}
      {editingFood && (
        <EditFoodModal
          food={editingFood}
          onSave={saveEdit}
          onClose={() => setEditingFood(null)}
        />
      )}
    </div>
  )
}

function EditFoodModal({ food, onSave, onClose }: {
  food: FoodEntry
  onSave: (updated: FoodEntry) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">編輯飲食記錄</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100">
            <X size={18} className="text-slate-400"/>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">食物名稱</label>
            <input className="input" value={form.name}
              onChange={e => setForm(p => ({...p, name: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              {key:'calories', label:'熱量 kcal'},
              {key:'protein', label:'蛋白質 g'},
              {key:'fat', label:'脂肪 g'},
              {key:'carbs', label:'碳水 g'},
            ] as const).map(({key, label}) => (
              <div key={key}>
                <label className="text-xs text-slate-500 block mb-1">{label}</label>
                <input type="number" className="input" value={form[key]}
                  onChange={e => setForm(p => ({...p, [key]: +e.target.value}))} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-500">
            取消
          </button>
          <button onClick={() => onSave({...food, ...form})} className="flex-1 btn-primary py-2.5">儲存</button>
        </div>
      </div>
    </div>
  )
}