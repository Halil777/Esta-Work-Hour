import { useContext } from 'react'
import { UiPreferencesContext } from './UiPreferencesProvider'

export function useUiPreferences() {
  return useContext(UiPreferencesContext)
}
