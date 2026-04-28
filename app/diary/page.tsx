'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { format, addDays, subDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useDiary, useSettings } from '@/lib/useStore'
import { FoodEntry, MealCategory, MEAL_LABELS } from '@/lib/types'
import { Plus, Camera, Keyboard, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X } from 'lucide-react'
import clsx from 'clsx'

const CATS = Object.keys(MEAL_LABELS) as MealCategory[]

export default function DiaryPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const { diary, setDiary } = useDiary()
  const { settings } = useSettings()

  // 日期狀態
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showDatePicker, setShowDatePicker] = useState(false)

  // 新增食物狀態
  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [category, setCategory] = useState<MealCategory>('lunch')
  const [aiText, setAiText] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [parsedResult, setParsedResult] = useState<{name: string, calories: number, protein: number, fat: number, carbs: number} | null>(null)
  const [manualForm, setManualForm] = useState({ name: '', calories: '', protein: '', fat: '', carbs: '' })
  const [expandedCat, setExpandedCat] = useState<MealCategory | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const todayRecord = diary.records[currentDate] ?? { date: currentDate, foods: [], exercises: [], water: 0 }

  function addFood(food: Omit<FoodEntry, 'id' | 'createdAt'>) {
    const entry: FoodEntry = { ...food, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    setDiary(prev => {
      const rec = prev.records[currentDate] ?? { date: currentDate, foods: [], exercises: [], water: 0 }
      return { ...prev, records: { ...prev.records, [currentDate]: { ...rec, foods: [...rec.foods, entry] } } }
    })
    setShowAdd(false)
    setAiText('')
    setImageBase64(null)
    setImagePreview(null)
    setParsedResult(null)
    setManualForm({ name: '', calories: '', protein: '', fat: '', carbs: '' })
  }

  function deleteFood(id: string) {
    setDiary(prev => {
      const rec = prev.records[currentDate]
      if (!rec) return prev
      return { ...prev, records: { ...prev.records, [currentDate]: { ...rec, foods: rec.foods.filter((f: FoodEntry) => f.id !== id) } } }
    })
  }

  function handleImageSelect(file: File) {
    // 只預覽，不自動解析
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function callGeminiDirect(prompt: string, imageBase64?: string): Promise<string> {
    const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite']
    for (const model of MODELS) {
      const parts: unknown[] = []
      if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } })
      parts.push({ text: prompt })
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts }] }) }
      )
      const data = await res.json()
      if (res.ok) return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const msg = data?.error?.message ?? ''
      const retryable = res.status === 503 || res.status === 429 || msg.includes('high demand') || msg.includes('quota')
      if (!retryable) throw new Error(msg)
    }
    throw new Error('所有模型目前忙碌，請稍後再試')
  }

  async function parseWithAI() {
    if (!settings.geminiApiKey) { alert('請先設定 Gemini API Key'); return }
    if (!aiText.trim() && !imageBase64) { alert('請輸入食物描述或上傳圖片'); return }
    setLoading(true)

    const prompt = imageBase64
      ? `你是專業營養師。請分析圖片中的食物營養成分${aiText ? `，使用者補充說明：${aiText}` : ''}。
請根據圖片內容加上補充說明，估算這份食物的總熱量與營養素。
只回傳 JSON，不要其他文字，格式：{"name":"食物完整名稱","calories":總熱量數字,"protein":蛋白質g數字,"fat":脂肪g數字,"carbs":碳水g數字}`
      : `你是專業營養師。使用者描述了他吃的食物：「${aiText}」
請根據這份描述，把所有提到的食材加總起來，估算這整份餐點的總熱量與營養素。
只回傳 JSON，不要其他文字，格式：{"name":"食物完整名稱","calories":總熱量數字,"protein":蛋白質g數字,"fat":脂肪g數字,"carbs":碳水g數字}`

    try {
      const text = await callGeminiDirect(prompt, imageBase64 ?? undefined)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) { alert('AI 無法解析，請重試或改用手動輸入'); return }
      const parsed = JSON.parse(jsonMatch[0])
      setParsedResult(parsed)
    } catch (e) {
      console.error(e)
      alert('AI 解析失敗：' + e)
    } finally {
      setLoading(false)
    }
  }

  const totalCals = todayRecord.foods.reduce((s: number, f: FoodEntry) => s + f.calories, 0)
  const dateLabel = format(new Date(currentDate + 'T00:00:00'), 'M月d日 EEEE', { locale: zhTW })
  const isToday = currentDate === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="animate-in">
      {/* Header with date navigation */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl">飲食記錄</h1>
          <span className="text-sm text-slate-400">{totalCals} kcal</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => setCurrentDate(format(subDays(new Date(currentDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
            className="p-1.5 rounded-lg active:bg-surface-100">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>

          <button onClick={() => setShowDatePicker(true)}
            className="flex flex-col items-center">
            <span className="text-sm font-medium text-slate-700">{dateLabel}</span>
            {!isToday && (
              <span className="text-xs text-brand-600 font-medium">非今日</span>
            )}
          </button>

          <button onClick={() => setCurrentDate(format(addDays(new Date(currentDate + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
            className="p-1.5 rounded-lg active:bg-surface-100"
            disabled={isToday}>
            <ChevronRight size={18} className={isToday ? 'text-slate-200' : 'text-slate-500'} />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setCurrentDate(format(new Date(), 'yyyy-MM-dd'))}
            className="w-full text-center text-xs text-brand-600 py-1 active:opacity-70">
            回到今天
          </button>
        )}
      </div>

      {/* Date picker modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowDatePicker(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-700 mb-3">選擇日期</h3>
            <input type="date" className="input"
              value={currentDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setCurrentDate(e.target.value); setShowDatePicker(false) }} />
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        {CATS.map(cat => {
          const items = todayRecord.foods.filter((f: FoodEntry) => f.category === cat)
          const catCals = items.reduce((s: number, f: FoodEntry) => s + f.calories, 0)
          const open = expandedCat === cat
          return (
            <div key={cat} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between"
                onClick={() => setExpandedCat(open ? null : cat)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{MEAL_LABELS[cat]}</span>
                  {items.length > 0 && (
                    <span className="text-xs bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 font-medium">
                      {catCals} kcal
                    </span>
                  )}
                </div>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {open && (
                <div className="mt-3 space-y-2">
                  {items.length === 0 && (
                    <p className="text-sm text-slate-400 py-2 text-center">尚無記錄</p>
                  )}
                  {items.map((f: FoodEntry) => (
                    <div key={f.id} className="flex items-center justify-between bg-surface-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{f.name}</p>
                        <p className="text-xs text-slate-400">
                          {f.calories}kcal · 蛋白{f.protein}g · 脂{f.fat}g · 碳水{f.carbs}g
                        </p>
                      </div>
                      <button onClick={() => deleteFood(f.id)} className="p-1.5 text-slate-300 active:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => { setCategory(cat); setShowAdd(true) }}
                    className="w-full py-2 rounded-xl border border-dashed border-surface-300 text-sm text-slate-400 active:bg-surface-50">
                    + 新增{MEAL_LABELS[cat]}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <button onClick={() => setShowAdd(true)}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3.5">
          <Plus size={20} /> 新增飲食
        </button>
      </div>

      {/* Add food modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto" />
            <h2 className="font-display font-bold text-lg">新增飲食</h2>

            {/* Category picker */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATS.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={clsx('flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    category === c ? 'bg-brand-600 text-white' : 'bg-surface-100 text-slate-600')}>
                  {MEAL_LABELS[c]}
                </button>
              ))}
            </div>

            {/* Mode toggle */}
            <div className="flex bg-surface-100 rounded-xl p-1">
              {(['ai', 'manual'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                    mode === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400')}>
                  {m === 'ai' ? <><Camera size={14} /> AI 解析</> : <><Keyboard size={14} /> 手動輸入</>}
                </button>
              ))}
            </div>

            {mode === 'ai' ? (
              <div className="space-y-3">
                {/* Image preview */}
                {imagePreview && (
                  <div className="relative">
                    <img src={imagePreview} alt="食物圖片" className="w-full h-40 object-cover rounded-xl" />
                    <button onClick={() => { setImageBase64(null); setImagePreview(null) }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center">
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                )}

                {/* Text input */}
                <textarea className="input resize-none h-20"
                  placeholder={imagePreview
                    ? '可補充說明，例如：份量大概一個拳頭、有加醬油'
                    : '輸入食物名稱與份量，例如：雞腿便當（飯半碗）'}
                  value={aiText}
                  onChange={e => setAiText(e.target.value)} />

                {/* Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-600 flex items-center justify-center gap-1.5 active:bg-surface-50">
                    <Camera size={15} /> {imagePreview ? '重新拍照' : '拍照上傳'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                  <button onClick={parseWithAI} disabled={loading || (!aiText.trim() && !imageBase64)}
                    className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                    {loading ? '解析中…' : 'AI 解析'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  {imagePreview ? '上傳圖片後可補充備註，再按 AI 解析' : '可以只輸入文字、只拍照，或兩者一起'}
                </p>

                {/* AI 解析結果確認 */}
                {parsedResult && (
                  <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 space-y-3 animate-in">
                    <p className="text-sm font-semibold text-brand-700">✨ AI 解析結果，請確認或修改</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">食物名稱</label>
                        <input className="input bg-white" value={parsedResult.name}
                          onChange={e => setParsedResult(p => p ? {...p, name: e.target.value} : p)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          {key: 'calories', label: '熱量 kcal'},
                          {key: 'protein', label: '蛋白質 g'},
                          {key: 'fat', label: '脂肪 g'},
                          {key: 'carbs', label: '碳水 g'},
                        ] as const).map(({key, label}) => (
                          <div key={key}>
                            <label className="text-xs text-slate-500 block mb-1">{label}</label>
                            <input type="number" className="input bg-white"
                              value={parsedResult[key]}
                              onChange={e => setParsedResult(p => p ? {...p, [key]: +e.target.value} : p)} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setParsedResult(null)}
                        className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-500 active:bg-surface-50">
                        重新解析
                      </button>
                      <button onClick={() => addFood({...parsedResult, category})}
                        className="flex-1 btn-primary py-2.5">
                        確認新增
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input className="input" placeholder="食物名稱" value={manualForm.name}
                  onChange={e => setManualForm(p => ({ ...p, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  {(['calories', 'protein', 'fat', 'carbs'] as const).map(k => (
                    <input key={k} type="number" className="input"
                      placeholder={{ calories: '熱量 kcal', protein: '蛋白質 g', fat: '脂肪 g', carbs: '碳水 g' }[k]}
                      value={manualForm[k]}
                      onChange={e => setManualForm(p => ({ ...p, [k]: e.target.value }))} />
                  ))}
                </div>
                <button onClick={() => addFood({
                  name: manualForm.name, category,
                  calories: +manualForm.calories, protein: +manualForm.protein,
                  fat: +manualForm.fat, carbs: +manualForm.carbs,
                })} disabled={!manualForm.name} className="btn-primary w-full py-3 disabled:opacity-50">
                  新增
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}