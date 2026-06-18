export type ThemeMode = 'dark' | 'light'
export type Language = 'en' | 'ru' | 'tr'

export type WorkerStatus = 'Active' | 'Inactive' | 'Suspended' | 'Transferred' | 'Terminated'

export type AuthUser = {
  id: string
  name: string
  role: 'ObjectAdmin' | 'SiteChief' | 'HR' | 'Foreman' | 'Timekeeper'
  objectName: string
  objectId: string
}
