// 全部改用 StoreContext，確保所有頁面共用同一份資料
export { useDiary, useSettings, useWeightLog, useStore } from './StoreContext'