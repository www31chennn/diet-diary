'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-full max-w-sm text-center animate-in">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-200">
            <span className="text-4xl">🥗</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-800">飲食日記</h1>
          <p className="text-slate-500 mt-1 text-sm">Diet Diary</p>
        </div>

        {/* Features */}
        <div className="text-left space-y-3 mb-10">
          {[
            ['📸', '拍照 AI 自動辨識食物熱量'],
            ['☁️', '資料同步到你的 Google Drive'],
            ['📊', '體重體脂長期趨勢追蹤'],
            ['🤖', 'AI 每日、每週個人化建議'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-card">
              <span className="text-xl">{icon}</span>
              <span className="text-sm text-slate-700">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-surface-200
                     rounded-2xl px-6 py-4 font-semibold text-slate-700 shadow-card
                     active:scale-95 transition-all duration-150"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          使用 Google 帳號登入
        </button>

        <p className="text-xs text-slate-400 mt-6 leading-relaxed">
          登入即授權 App 讀寫你 Google Drive 中<br />
          「Diet Diary」資料夾的資料
        </p>
      </div>
    </div>
  )
}
