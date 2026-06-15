import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { AppProvider, useApp } from './src/context/AppContext'
import { RootNavigator } from './src/navigation/RootNavigator'

function Inner() {
  const { theme } = useApp()
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  )
}
