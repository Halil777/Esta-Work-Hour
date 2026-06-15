import { RouterProvider } from 'react-router-dom'
import { UiPreferencesProvider } from './providers/UiPreferencesProvider.tsx'
import { router } from './router.tsx'

function App() {
  return (
    <UiPreferencesProvider>
      <RouterProvider router={router} />
    </UiPreferencesProvider>
  )
}

export default App
