'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { DiaryData, UserSettings, WeightLog } from './types'
import { calcDailyGoals } from './calcGoals'

// ---- Drive helpers ----
const DRIVE_PERMISSION_ERROR = 'NO_DRIVE_PERMISSION'

async function driveRead<T>(file: string): Promise<T | null | typeof DRIVE_PERMISSION_ERROR> {
  try {
    const res = await fetch(`/api/drive?file=${file}`)
    if (res.status === 403) return DRIVE_PERMISSION_ERROR
    if (!res.ok) return null
    const { data } = await res.json()
    return data ?? null
  } catch {
    return null
  }
}

async function driveWrite(file: string, data: unknown) {
  try {
    await fetch(`/api/drive?file=${file}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
  } catch (e) {
    console.error(`[Store] Write error ${file}:`, e)
  }
}

function useDebounce<T>(fn: (d: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((d: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(d), delay)
  }, [fn, delay])
}

// ---- Context types ----
interface SuggestionsData {
  daily?: string
  'weekly-diet'?: string
  'weekly-exercise'?: string
  plan?: string
}

interface StoreContextType {
  diary: DiaryData
  setDiary: (updater: (prev: DiaryData) => DiaryData) => void
  diaryLoading: boolean
  settings: UserSettings
  setSettings: (updater: (prev: UserSettings) => UserSettings) => void
  settingsLoading: boolean
  log: WeightLog
  setLog: (updater: (prev: WeightLog) => WeightLog) => void
  logLoading: boolean
  suggestions: SuggestionsData
  setSuggestions: React.Dispatch<React.SetStateAction<SuggestionsData>>
  driveError: string | null
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [diary, setDiaryRaw] = useState<DiaryData>({ records: {} })
  const [diaryLoading, setDiaryLoading] = useState(true)
  const [settings, setSettingsRaw] = useState<UserSettings>({} as UserSettings)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [log, setLogRaw] = useState<WeightLog>({ entries: [] })
  const [suggestions, setSuggestions] = useState<SuggestionsData>({})
  const { status, data: session } = useSession()
  const [driveError, setDriveError] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated') return
    // 確認有 Drive 權限
    if ((session as any)?.hasDriveScope === false) {
      setDriveError('NO_DRIVE_PERMISSION')
      setDiaryLoading(false)
      setSettingsLoading(false)
      setLogLoading(false)
      return
    }
    driveRead<DiaryData>('diary-data.json').then(d => {
      if (d === DRIVE_PERMISSION_ERROR) { setDriveError('NO_DRIVE_PERMISSION'); setDiaryLoading(false); return }
      if (d) setDiaryRaw(d)
      setDiaryLoading(false)
    })
    driveRead<UserSettings>('settings.json').then(d => {
      if (d === DRIVE_PERMISSION_ERROR) { setDriveError('NO_DRIVE_PERMISSION'); setSettingsLoading(false); return }
      if (d) {
        // 有身高體重但沒有每日目標，自動計算並存回 Drive
        const needsCalc = !!(d.height && d.weight && !d.dailyCalories)
        if (needsCalc) {
          const { _summary, ...goals } = calcDailyGoals(d) as any
          // goals 不含 bmr/tdee，不會覆蓋使用者填的 InBody 值
          const merged = { ...d, ...goals }
          console.log('[Store] Auto-calculated goals:', goals)
          setSettingsRaw(merged)
          driveWrite('settings.json', merged)
        } else {
          setSettingsRaw(d)
        }
      }
      setSettingsLoading(false)
    })
    driveRead<WeightLog>('weight-log.json').then(d => {
      if (d === DRIVE_PERMISSION_ERROR) { setDriveError('NO_DRIVE_PERMISSION'); setLogLoading(false); return }
      if (d) setLogRaw(d)
      setLogLoading(false)
    })
  }, [status])

  const syncDiary = useDebounce((d: DiaryData) => driveWrite('diary-data.json', d), 1500)
  const syncSettings = useDebounce((d: UserSettings) => {
    const masked = { ...d, geminiApiKey: d.geminiApiKey ? '***' : '' }
    console.log('[Store] Saving settings:', masked)
    driveWrite('settings.json', d)
  }, 1000)
  const syncLog = useDebounce((d: WeightLog) => driveWrite('weight-log.json', d), 1500)

  const setDiary = useCallback((updater: (prev: DiaryData) => DiaryData) => {
    setDiaryRaw(prev => { const next = updater(prev); syncDiary(next); return next })
  }, [syncDiary])

  const setSettings = useCallback((updater: (prev: UserSettings) => UserSettings) => {
    setSettingsRaw(prev => { const next = updater(prev); syncSettings(next); return next })
  }, [syncSettings])

  const setLog = useCallback((updater: (prev: WeightLog) => WeightLog) => {
    setLogRaw(prev => { const next = updater(prev); syncLog(next); return next })
  }, [syncLog])

  return (
    <StoreContext.Provider value={{
      diary, setDiary, diaryLoading,
      settings, setSettings, settingsLoading,
      log, setLog, logLoading,
      suggestions, setSuggestions,
      driveError,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// 向下相容的 hooks
export function useDiary() {
  const { diary, setDiary, diaryLoading } = useStore()
  return { diary, setDiary, loading: diaryLoading }
}

export function useSettings() {
  const { settings, setSettings, settingsLoading } = useStore()
  return { settings, setSettings, loading: settingsLoading }
}

export function useWeightLog() {
  const { log, setLog, logLoading } = useStore()
  return { log, setLog, loading: logLoading }
}
