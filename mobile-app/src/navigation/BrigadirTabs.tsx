import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text } from 'react-native'
import { BrigadirDashboardScreen } from '../screens/brigadir/DashboardScreen'
import { QRScanScreen } from '../screens/brigadir/QRScanScreen'
import { WorkersScreen } from '../screens/brigadir/WorkersScreen'
import { BrigadirOvertimeScreen } from '../screens/brigadir/OvertimeScreen'
import { SyncScreen } from '../screens/brigadir/SyncScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { useApp } from '../context/AppContext'
import { palette } from '../theme/colors'

const Tab = createBottomTabNavigator()

const TAB_ICONS: Record<string, string> = {
  Today: '📋', Scan: '📷', Workers: '👷', Overtime: '⏱️', Sync: '🔄', Settings: '⚙️',
}

export function BrigadirTabs() {
  const { colors, t } = useApp()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{TAB_ICONS[route.name]}</Text>
        ),
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, borderTopWidth: 1 },
        headerStyle: { backgroundColor: colors.header },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerTintColor: colors.text,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Today" component={BrigadirDashboardScreen} options={{ title: t.tabs.today }} />
      <Tab.Screen name="Scan" component={QRScanScreen} options={{ title: t.tabs.scan }} />
      <Tab.Screen name="Workers" component={WorkersScreen} options={{ title: t.tabs.workers }} />
      <Tab.Screen name="Overtime" component={BrigadirOvertimeScreen} options={{ title: t.tabs.overtime }} />
      <Tab.Screen name="Sync" component={SyncScreen} options={{ title: t.tabs.sync }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.common.settings }} />
    </Tab.Navigator>
  )
}
