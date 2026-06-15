import { useContext } from 'react'
import { UiPreferencesContext } from '../app/providers/UiPreferencesProvider'
import { translations } from './translations'

export function useTranslation() {
  const { language } = useContext(UiPreferencesContext)
  return { t: translations[language] }
}
