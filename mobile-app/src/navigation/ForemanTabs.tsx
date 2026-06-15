import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { ForemanDashboardScreen } from '../screens/foreman/DashboardScreen'
import { BrigadesScreen } from '../screens/foreman/BrigadesScreen'
import { ForemanAttendanceScreen } from '../screens/foreman/AttendanceScreen'
import { ForemanOvertimeScreen } from '../screens/foreman/OvertimeScreen'
import { NotificationsScreen } from '../screens/foreman/NotificationsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { useApp } from '../context/AppContext'
import { palette } from '../theme/colors'

const Tab = createBottomTabNavigator()

const TAB_ICONS: Record<string, string> = {
  Dashboard: '📊', Brigades: '🏗️', Attendance: '📋', Overtime: '⏱️', Notifications: '🔔', Settings: '⚙️',
}

export function ForemanTabs() {
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
      <Tab.Screen name="Dashboard" component={ForemanDashboardScreen} options={{ title: t.tabs.dashboard }} />
      <Tab.Screen name="Brigades" component={BrigadesScreen} options={{ title: t.tabs.brigades }} />
      <Tab.Screen name="Attendance" component={ForemanAttendanceScreen} options={{ title: t.tabs.attendance }} />
      <Tab.Screen name="Overtime" component={ForemanOvertimeScreen} options={{ title: t.tabs.overtime }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: t.common.notifications }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.common.settings }} />
    </Tab.Navigator>
  )
}
