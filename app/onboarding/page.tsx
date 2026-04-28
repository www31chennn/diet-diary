'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, Key, Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function saveAndClose() {
    localStorage.setItem('onboarding_seen', '1')

    if (!apiKey.trim()) {
      router.back()
      return
    }

    setSaving(true)
    setError('')

    try {
      // 先讀取現有 settings
      const readRes = await fetch('/api/drive?file=settings.json')
      const { data: existing } = await readRes.json()

      // 合併新的 API Key
      const newSettings = { ...(existing ?? {}), geminiApiKey: apiKey.trim() }

      // 寫回 Drive
      const writeRes = await fetch('/api/drive?file=settings.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newSettings }),
      })

      if (!writeRes.ok) {
        setError('儲存失敗，請重試')
        setSaving(false)
        return
      }

      console.log('[Onboarding] API Key saved to Drive')
      // 強制重新載入頁面讓 StoreContext 重新從 Drive 讀取
      window.location.href = '/'
    } catch (e) {
      setError('網路錯誤，請重試')
      setSaving(false)
    }
  }

  function skipAndClose() {
    localStorage.setItem('onboarding_seen', '1')
    router.back()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-sm">🥗</div>
            <h2 className="font-display font-bold text-lg">如何取得 API Key</h2>
          </div>
          <button onClick={skipAndClose} className="p-1.5 rounded-lg hover:bg-surface-100">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <p className="text-sm text-slate-500">
            使用 AI 分析功能，請填入 Gemini API Key，免費申請只需 3 分鐘。
          </p>

          {/* 步驟說明 */}
          <div className="bg-surface-50 rounded-xl p-4 space-y-3">
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
              className="flex items-center justify-between text-sm font-medium text-blue-600 hover:text-blue-700">
              前往 Google AI Studio 申請
              <ExternalLink size={14} />
            </a>
            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
                用 Google 帳號登入
              </div>
              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                點「Create API Key」，選擇 Diet Diary 專案
              </div>
              <div className="flex gap-2">
                <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold flex-shrink-0">3</span>
                複製產生的 Key（AIza 開頭）貼到下方
              </div>
            </div>
            <p className="text-xs text-amber-600">💡 每日免費 500 次，超過自動暫停，不會產生費用</p>
          </div>

          {/* 輸入 */}
          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Key size={14} /> 貼上你的 API Key
            </label>
            <input
              type="password"
              className="input font-mono text-sm"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* 按鈕 */}
          <div className="flex gap-2">
            <button onClick={skipAndClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm text-slate-500 hover:bg-surface-50">
              跳過
            </button>
            <button onClick={saveAndClose} disabled={saving}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> 儲存中…</> : apiKey.trim() ? '確認儲存' : '不填，先跳過'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}