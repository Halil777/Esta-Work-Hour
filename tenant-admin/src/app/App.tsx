import { RouterProvider } from 'react-router-dom'
import { UiPreferencesProvider } from './providers/UiPreferencesProvider'
import { router } from './router'

function App() {
  return (
    <UiPreferencesProvider>
      <RouterProvider router={router} />
    </UiPreferencesProvider>
  )
}

export default App
