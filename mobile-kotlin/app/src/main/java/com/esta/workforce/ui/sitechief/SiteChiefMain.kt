package com.esta.workforce.ui.sitechief

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.esta.workforce.AppContainer
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.foreman.notifications.NotificationsScreen
import com.esta.workforce.ui.settings.SettingsScreen
import com.esta.workforce.ui.sitechief.approvals.ApprovalsScreen
import com.esta.workforce.ui.sitechief.attendance.SCAttendanceScreen
import com.esta.workforce.ui.sitechief.dashboard.SCDashboardScreen
import com.esta.workforce.ui.sitechief.reports.ReportsScreen
import com.esta.workforce.ui.theme.LocalAppColors
import com.esta.workforce.ui.theme.LocalStrings
import com.esta.workforce.ui.theme.Primary

private enum class SCTab(val icon: ImageVector) {
    DASHBOARD(Icons.Filled.Dashboard),
    APPROVALS(Icons.Filled.CheckCircle),
    ATTENDANCE(Icons.Filled.Assignment),
    REPORTS(Icons.Filled.BarChart),
    NOTIFICATIONS(Icons.Filled.Notifications),
    SETTINGS(Icons.Filled.Settings),
}

@Composable
fun SiteChiefMain(
    appVm: AppViewModel,
    container: AppContainer,
    onLogout: () -> Unit,
) {
    val strings = LocalStrings.current
    val colors = LocalAppColors.current
    var selected by remember { mutableStateOf(SCTab.DASHBOARD) }

    val tabLabels = mapOf(
        SCTab.DASHBOARD to strings.tabDashboard,
        SCTab.APPROVALS to strings.tabApprovals,
        SCTab.ATTENDANCE to strings.tabAttendance,
        SCTab.REPORTS to strings.tabReports,
        SCTab.NOTIFICATIONS to strings.notifications,
        SCTab.SETTINGS to strings.settings,
    )

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = colors.tabBar, tonalElevation = 0.dp) {
                SCTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selected == tab,
                        onClick = { selected = tab },
                        icon = { Icon(tab.icon, contentDescription = tabLabels[tab]) },
                        label = { Text(tabLabels[tab] ?: "", maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Primary,
                            selectedTextColor = Primary,
                            indicatorColor = colors.card2,
                            unselectedIconColor = colors.textMuted,
                            unselectedTextColor = colors.textMuted,
                        ),
                    )
                }
            }
        },
        containerColor = colors.bg,
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selected) {
                SCTab.DASHBOARD -> SCDashboardScreen(appVm = appVm, container = container)
                SCTab.APPROVALS -> ApprovalsScreen(container = container)
                SCTab.ATTENDANCE -> SCAttendanceScreen(container = container)
                SCTab.REPORTS -> ReportsScreen(container = container)
                SCTab.NOTIFICATIONS -> NotificationsScreen(container = container)
                SCTab.SETTINGS -> SettingsScreen(appVm = appVm, onLogout = onLogout)
            }
        }
    }
}
