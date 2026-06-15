import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { SiteChiefDashboardScreen } from '../screens/sitechief/DashboardScreen'
import { ApprovalsScreen } from '../screens/sitechief/ApprovalsScreen'
import { SiteChiefAttendanceScreen } from '../screens/sitechief/AttendanceScreen'
import { ReportsScreen } from '../screens/sitechief/ReportsScreen'
import { NotificationsScreen } from '../screens/foreman/NotificationsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { useApp } from '../context/AppContext'
import { palette } from '../theme/colors'

const Tab = createBottomTabNavigator()

const TAB_ICONS: Record<string, string> = {
  Dashboard: '📊', Approvals: '✅', Attendance: '📋', Reports: '📈', Notifications: '🔔', Settings: '⚙️',
}

export function SiteChiefTabs() {
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
      <Tab.Screen name="Dashboard" component={SiteChiefDashboardScreen} options={{ title: t.tabs.dashboard }} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ title: t.tabs.approvals }} />
      <Tab.Screen name="Attendance" component={SiteChiefAttendanceScreen} options={{ title: t.tabs.attendance }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: t.tabs.reports }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: t.common.notifications }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.common.settings }} />
    </Tab.Navigator>
  )
}
