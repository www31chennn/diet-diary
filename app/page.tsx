'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { format, subDays, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useDiary, useSettings } from '@/lib/useStore'
import { FoodEntry, ExerciseEntry, MEAL_LABELS, MealCategory, EXERCISE_LABELS, ExerciseType, EXERCISE_MET } from '@/lib/types'
import { Trash2, Pencil, Camera, Keyboard, X, ChevronDown, ChevronUp } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import clsx from 'clsx'

const today = format(new Date(), 'yyyy-MM-dd')
const CATS = Object.keys(MEAL_LABELS) as MealCategory[]

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { diary, setDiary, loading: diaryLoading } = useDiary()
  const { settings, loading: settingsLoading } = useSettings()

  const [diaryDate, setDiaryDate] = useState(today)
  const [mode, setMode] = useState<'ai'|'manual'>('ai')
  const [category, setCategory] = useState<MealCategory>('lunch')
  const [aiText, setAiText] = useState('')
  const [imageBase64, setImageBase64] = useState<string|null>(null)
  const [imagePreview, setImagePreview] = useState<string|null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [manualForm, setManualForm] = useState({name:'',calories:'',protein:'',fat:'',carbs:''})
  const [editingFood, setEditingFood] = useState<FoodEntry|null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null)
  const [waterInput, setWaterInput] = useState('')
  const [expandedCat, setExpandedCat] = useState<MealCategory|null>(null)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (settingsLoading) return
    // 用 localStorage 記錄是否已看過 onboarding
    const seen = localStorage.getItem('onboarding_seen')
    if (!seen && settings.geminiApiKey === undefined) {
      router.push('/onboarding')
    }
  }, [status, settingsLoading, settings.geminiApiKey, router])

  if (status === 'loading' || settingsLoading) return <LoadingScreen />
  if (status === 'unauthenticated') return <LoadingScreen />

  const rec = diary.records[diaryDate] ?? { date: diaryDate, foods: [], exercises: [], water: 0 }
  const totalCals = rec.foods.reduce((s:number, f:FoodEntry) => s + f.calories, 0)
  const totalProtein = rec.foods.reduce((s:number, f:FoodEntry) => s + f.protein, 0)
  const totalFat = rec.foods.reduce((s:number, f:FoodEntry) => s + f.fat, 0)
  const totalCarbs = rec.foods.reduce((s:number, f:FoodEntry) => s + f.carbs, 0)
  const burnedCals = rec.exercises.reduce((s:number, e:ExerciseEntry) => s + e.caloriesBurned, 0)
  const netCals = totalCals - burnedCals

  // 預設值：無設定時用一般成人標準
  const goalCals = settings.dailyCalories ?? 1800
  const goalProtein = settings.dailyProtein ?? 60
  const goalFat = settings.dailyFat ?? 60
  const goalCarbs = settings.dailyCarbs ?? 225
  const goalWater = settings.dailyWater ?? 2000
  const bmr = settings.bmr ?? 0

  function addFood(food: Omit<FoodEntry,'id'|'createdAt'>) {
    const entry: FoodEntry = {...food, id: crypto.randomUUID(), createdAt: new Date().toISOString()}
    setDiary(prev => {
      const r = prev.records[diaryDate] ?? {date: diaryDate, foods:[], exercises:[], water:0}
      return {...prev, records: {...prev.records, [diaryDate]: {...r, foods:[...r.foods, entry]}}}
    })
    setAiText(''); setImageBase64(null); setImagePreview(null)
    setManualForm({name:'',calories:'',protein:'',fat:'',carbs:''})
  }

  function saveEdit(updated: FoodEntry) {
    setDiary(prev => {
      const r = prev.records[diaryDate]
      if (!r) return prev
      return { ...prev, records: { ...prev.records, [diaryDate]: {
        ...r,
        foods: r.foods.map((f: FoodEntry) => f.id === updated.id ? updated : f)
      }}}
    })
    setEditingFood(null)
  }

  function deleteFood(id: string) {
    setDiary(prev => {
      const r = prev.records[diaryDate]; if (!r) return prev
      return {...prev, records: {...prev.records, [diaryDate]: {...r, foods: r.foods.filter((f:FoodEntry) => f.id !== id)}}}
    })
  }

  function addWater(ml: number) {
    setDiary(prev => {
      const r = prev.records[diaryDate] ?? {date:diaryDate, foods:[], exercises:[], water:0}
      return {...prev, records: {...prev.records, [diaryDate]: {...r, water: r.water + ml}}}
    })
  }

  function handleImageSelect(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target?.result as string
      setImagePreview(url); setImageBase64(url.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function callGemini(prompt: string, imgBase64?: string): Promise<string> {
    const MODELS = ['gemini-3.1-flash-lite-preview','gemini-2.5-flash-lite']
    for (const model of MODELS) {
      const parts: unknown[] = []
      if (imgBase64) parts.push({inline_data:{mime_type:'image/jpeg',data:imgBase64}})
      parts.push({text: prompt})
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
        {method:'POST', headers:{'Content-Type':'application/json'},
         body: JSON.stringify({contents:[{role:'user',parts}]})}
      )
      const data = await res.json()
      if (res.ok) return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const msg = data?.error?.message ?? ''
      if (!(res.status===503||res.status===429||msg.includes('high demand')||msg.includes('quota'))) throw new Error(msg)
    }
    throw new Error('所有模型忙碌，請稍後再試')
  }

  async function parseWithAI() {
    setAiError('')
    if (!settings.geminiApiKey) { setAiError('尚未填寫 Gemini API Key，請先至設定頁面填入'); return }
    if (!aiText.trim() && !imageBase64) { setAiError('請輸入食物描述或上傳圖片'); return }
    setAiLoading(true)
    const prompt = imageBase64
      ? `你是專業營養師。分析圖片中的食物${aiText?`，補充說明：${aiText}`:''}。把所有食材加總，只回傳JSON：{"name":"食物名稱","calories":數字,"protein":數字,"fat":數字,"carbs":數字}`
      : `你是專業營養師。使用者吃了：「${aiText}」，把所有提到的食材加總，只回傳JSON：{"name":"食物名稱","calories":數字,"protein":數字,"fat":數字,"carbs":數字}`
    try {
      const text = await callGemini(prompt, imageBase64??undefined)
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) { alert('AI 無法解析，請重試或改用手動輸入'); return }
      addFood({...JSON.parse(m[0]), category})
    } catch(e) { setAiError('AI 解析失敗：'+e) }
    finally { setAiLoading(false) }
  }

  const dateLabel = format(new Date(), 'yyyy/MM/dd', {locale: zhTW})

  return (
    <div className="px-4 py-4 space-y-4 animate-in">
      {/* BMR 警告 */}
      {bmr > 0 && netCals < bmr && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
          ⚠️ 今日攝取低於基礎代謝率，建議至少吃 {bmr} kcal
        </div>
      )}

      {/* 熱量 + 營養素 - 手機2x2，電腦4x1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          {label:'熱量', val: totalCals, goal: goalCals, unit:'kcal', color:'bg-brand-500', textColor:'text-brand-600'},
          {label:'蛋白質', val: Math.round(totalProtein), goal: goalProtein, unit:'g', color:'bg-blue-400', textColor:'text-blue-500'},
          {label:'脂肪', val: Math.round(totalFat), goal: goalFat, unit:'g', color:'bg-amber-400', textColor:'text-amber-500'},
          {label:'碳水', val: Math.round(totalCarbs), goal: goalCarbs, unit:'g', color:'bg-purple-400', textColor:'text-purple-500'},
        ].map(({label,val,goal,unit,color,textColor}) => (
          <div key={label} className="card p-3">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="font-bold text-slate-800 text-lg leading-tight">
              {val}<span className="text-xs font-normal text-slate-400">/{goal}{unit}</span>
            </p>
            <div className="h-1.5 bg-surface-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all`} style={{width:`${Math.min(val/goal*100,100)}%`}} />
            </div>
          </div>
        ))}
      </div>

      {/* 熱量平衡 */}
      <div className="card">
        <p className="text-xs text-slate-400 mb-3">今日熱量平衡</p>
        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-2xl font-bold text-brand-600">{totalCals}</p>
            <p className="text-xs text-slate-400 mt-0.5">飲食攝取</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-400">{burnedCals}</p>
            <p className="text-xs text-slate-400 mt-0.5">運動消耗</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-700">{netCals}</p>
            <p className="text-xs text-slate-400 mt-0.5">淨攝取</p>
          </div>
        </div>
        {goalCals > netCals && (
          <p className="text-center text-xs text-brand-600 mt-3 font-medium">
            還可以吃 <span className="font-bold text-base">{goalCals - netCals}</span> kcal
          </p>
        )}
      </div>

      {/* 喝水 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">喝水目標</p>
          <p className={clsx('text-sm font-semibold', rec.water >= goalWater ? 'text-brand-600' : 'text-slate-400')}>
            {rec.water}/{goalWater}ml {rec.water < goalWater && '未達標'}
          </p>
        </div>
        <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full bg-sky-400 rounded-full transition-all" style={{width:`${Math.min(rec.water/goalWater*100,100)}%`}} />
        </div>
        <div className="flex gap-2">
          {[200, 500].map(ml => (
            <button key={ml} onClick={() => addWater(ml)}
              className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-sm font-medium active:scale-95 transition-transform">
              +{ml}
            </button>
          ))}
          <button onClick={() => setDiary(prev => {
            const r = prev.records[diaryDate]; if (!r) return prev
            return {...prev, records: {...prev.records, [diaryDate]: {...r, water: 0}}}
          })} className="px-3 py-1.5 rounded-lg bg-surface-100 text-slate-400 text-sm">重設</button>
          <div className="flex-1 flex gap-1">
            <input type="number" className="input py-1.5 text-sm" placeholder="自填 ml"
              value={waterInput} onChange={e => setWaterInput(e.target.value)} />
            <button onClick={() => { if(waterInput) { addWater(+waterInput); setWaterInput('') }}}
              className="btn-primary px-3 py-1.5 text-sm whitespace-nowrap">+ 新增</button>
          </div>
        </div>
      </div>

      {/* 飲食記錄 */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-sm font-semibold text-slate-700">飲食紀錄</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setDiaryDate(d => {
              const prev = new Date(d + 'T00:00:00'); prev.setDate(prev.getDate()-1)
              return format(prev,'yyyy-MM-dd')
            })} className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-slate-500 text-xs active:bg-surface-200">‹</button>
            <input type="date" className="text-xs text-slate-500 bg-transparent border-0 outline-none cursor-pointer"
              value={diaryDate} max={today}
              onChange={e => setDiaryDate(e.target.value)} />
            <button onClick={() => {
              const next = new Date(diaryDate + 'T00:00:00'); next.setDate(next.getDate()+1)
              const nextStr = format(next,'yyyy-MM-dd')
              if (nextStr <= today) setDiaryDate(nextStr)
            }} className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-slate-500 text-xs active:bg-surface-200">›</button>
          </div>
        </div>

        {/* 分類 tabs - 換行顯示 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CATS.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                category === c ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-surface-200')}>
              {MEAL_LABELS[c]}
            </button>
          ))}
        </div>

        {/* 輸入區 */}
        <div className="card space-y-3">
          {/* API Key 未設定提示 */}
          {!settings.geminiApiKey && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
              <p className="text-sm text-amber-700">⚠️ 尚未填寫 Gemini API Key</p>
              <a href="/settings" className="text-sm font-semibold text-amber-700 underline">前往設定</a>
            </div>
          )}

          {/* AI / 手動 toggle */}
          <div className="flex bg-surface-100 rounded-xl p-1">
            {(['ai','manual'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400')}>
                {m === 'ai' ? <><Camera size={13}/> AI 解析</> : <><Keyboard size={13}/> 手動</>}
              </button>
            ))}
          </div>

          {mode === 'ai' ? (
            <div className="space-y-2">
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="" className="w-full h-36 object-cover rounded-xl" />
                  <button onClick={() => {setImageBase64(null);setImagePreview(null)}}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              )}
              <textarea className="input resize-none h-16 text-sm"
                placeholder={imagePreview ? '可補充說明，例如：份量約一個拳頭' : '例如：地瓜蛋餅一份、全糖鮮奶茶 700ml'}
                value={aiText} onChange={e => setAiText(e.target.value)} />
              <p className="text-xs text-amber-600">💡 建議寫清楚份量與細節，例如雞腿便當（飯半碗），AI 解析會更準確</p>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-600 cursor-pointer active:bg-surface-50">
                  <Camera size={14}/> 上傳或拍照辨識
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                </label>
                <button onClick={parseWithAI} disabled={aiLoading||(!aiText.trim()&&!imageBase64)}
                  className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                  {aiLoading ? '解析中…' : 'AI 解析'}
                </button>
              </div>
              {aiError && <p className="text-xs text-red-500 font-medium">{aiError}</p>}
              <p className="text-xs text-slate-400">💡 建議光線充足、食物佔畫面 70% 以上，多道菜可一起拍</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input className="input" placeholder="食物名稱" value={manualForm.name}
                onChange={e => setManualForm(p=>({...p,name:e.target.value}))} />
              <div className="grid grid-cols-2 gap-2">
                {([['calories','熱量 kcal'],['protein','蛋白質 g'],['fat','脂肪 g'],['carbs','碳水 g']] as const).map(([k,l]) => (
                  <input key={k} type="number" className="input" placeholder={l}
                    value={manualForm[k]} onChange={e => setManualForm(p=>({...p,[k]:e.target.value}))} />
                ))}
              </div>
              <button onClick={() => addFood({name:manualForm.name,category,
                calories:+manualForm.calories,protein:+manualForm.protein,fat:+manualForm.fat,carbs:+manualForm.carbs})}
                disabled={!manualForm.name} className="btn-primary w-full py-2.5 disabled:opacity-50">新增</button>
            </div>
          )}
        </div>

        {/* 今日飲食列表 */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-xs text-slate-400">{diaryDate === today ? '今日飲食' : `${diaryDate} 飲食`}</p>
            <p className="text-xs text-slate-400">{totalCals} kcal</p>
          </div>
          {rec.foods.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">今天還沒有飲食記錄</div>
          ) : (
            rec.foods.map((f: FoodEntry) => (
              <div key={f.id} className="bg-white rounded-xl px-4 py-3 border border-surface-100 flex items-center gap-3">
                {/* .el：時間標籤 + 食物名，佔剩餘空間 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 mb-0.5">
                    {MEAL_LABELS[f.category]} · {new Date(f.createdAt).toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit', timeZone:'Asia/Taipei'})}
                  </p>
                  <p className="text-sm font-medium text-slate-700 break-words">{f.name}</p>
                </div>
                {/* .macros：四格數字，不縮放 */}
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
                {/* 按鈕區，不縮放，垂直置中 */}
                <div className="flex items-center gap-0 flex-shrink-0 self-center">
                  <button onClick={() => setEditingFood({...f})} className="p-1 text-slate-300 active:text-slate-500">
                    <Pencil size={12}/>
                  </button>
                  <button onClick={() => setConfirmDeleteId(f.id)} className="p-1 text-slate-300 active:text-red-400">
                    <X size={13}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 編輯 modal */}
      {confirmDeleteId && (
        <ConfirmDialog
          onConfirm={() => { deleteFood(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
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

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
    </div>
  )
}
