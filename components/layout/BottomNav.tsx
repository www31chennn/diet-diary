'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Dumbbell, CalendarDays, TrendingUp, Lightbulb } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { href: '/',            icon: Home,         label: '今日' },
  { href: '/diary',       icon: BookOpen,      label: '飲食' },
  { href: '/exercise',    icon: Dumbbell,      label: '運動' },
  { href: '/calendar',    icon: CalendarDays,  label: '日曆' },
  { href: '/progress',    icon: TrendingUp,    label: '進度' },
  { href: '/suggestions', icon: Lightbulb,     label: 'AI 建議' },
]

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md
                    bg-white/90 backdrop-blur border-t border-surface-200
                    pb-safe z-50">
      <div className="grid grid-cols-6">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-brand-600' : 'text-slate-400'
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                className={clsx('transition-transform', active && 'scale-110')}
              />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
