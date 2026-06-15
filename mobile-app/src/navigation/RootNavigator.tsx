import React from 'react'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useApp } from '../context/AppContext'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { BrigadirTabs } from './BrigadirTabs'
import { ForemanTabs } from './ForemanTabs'
import { SiteChiefTabs } from './SiteChiefTabs'

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const { user, theme } = useApp()

  const navTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: theme === 'dark' ? '#0B1120' : '#F0F4F8',
      card: theme === 'dark' ? '#080F1C' : '#FFFFFF',
      text: theme === 'dark' ? '#E2E8F0' : '#0F172A',
      border: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      primary: '#6366F1',
    },
  }

  const MainTabs = () => {
    if (!user) return null
    if (user.role === 'Brigadir') return <BrigadirTabs />
    if (user.role === 'Foreman') return <ForemanTabs />
    return <SiteChiefTabs />
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user
          ? <Stack.Screen name="Login" component={LoginScreen} />
          : <Stack.Screen name="Main" component={MainTabs} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}
