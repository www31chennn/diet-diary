'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Home, BookOpen, Dumbbell, CalendarDays, TrendingUp, Lightbulb, Settings, LogOut } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { href: '/',            icon: Home,        label: '今日總覽' },
  { href: '/diary',       icon: BookOpen,    label: '飲食記錄' },
  { href: '/exercise',    icon: Dumbbell,    label: '運動記錄' },
  { href: '/calendar',    icon: CalendarDays,label: '日曆' },
  { href: '/progress',    icon: TrendingUp,  label: '體重進度' },
  { href: '/suggestions', icon: Lightbulb,   label: 'AI 建議' },
]

export function Sidebar() {
  const path = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-surface-200 sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-xl flex-shrink-0">
            🥗
          </div>
          <div>
            <p className="font-display font-bold text-slate-800 leading-tight">Diet Diary</p>
            <p className="text-xs text-slate-400">飲食日記</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-500 hover:bg-surface-50 hover:text-slate-700'
              )}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User info + settings */}
      <div className="px-3 pb-4 space-y-1 border-t border-surface-100 pt-3">
        <Link href="/settings"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            path === '/settings' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-surface-50'
          )}>
          <Settings size={18} strokeWidth={1.8} />
          設定
        </Link>

        {session?.user && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              {session.user.image && (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
              )}
              <p className="text-xs text-slate-500 truncate">{session.user.name}</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <LogOut size={13} />
              登出
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
