package com.esta.workforce.ui.foreman

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
import com.esta.workforce.ui.foreman.attendance.ForemanAttendanceScreen
import com.esta.workforce.ui.foreman.brigades.BrigadesScreen
import com.esta.workforce.ui.foreman.dashboard.ForemanDashboardScreen
import com.esta.workforce.ui.foreman.notifications.NotificationsScreen
import com.esta.workforce.ui.foreman.overtime.OvertimeScreen
import com.esta.workforce.ui.settings.SettingsScreen
import com.esta.workforce.ui.theme.LocalAppColors
import com.esta.workforce.ui.theme.LocalStrings
import com.esta.workforce.ui.theme.Primary

private enum class ForemanTab(val icon: ImageVector) {
    DASHBOARD(Icons.Filled.Dashboard),
    BRIGADES(Icons.Filled.Groups),
    ATTENDANCE(Icons.Filled.Assignment),
    OVERTIME(Icons.Filled.AccessTime),
    NOTIFICATIONS(Icons.Filled.Notifications),
    SETTINGS(Icons.Filled.Settings),
}

@Composable
fun ForemanMain(
    appVm: AppViewModel,
    container: AppContainer,
    onLogout: () -> Unit,
) {
    val strings = LocalStrings.current
    val colors = LocalAppColors.current
    var selected by remember { mutableStateOf(ForemanTab.DASHBOARD) }

    val tabLabels = mapOf(
        ForemanTab.DASHBOARD to strings.tabDashboard,
        ForemanTab.BRIGADES to strings.tabBrigades,
        ForemanTab.ATTENDANCE to strings.tabAttendance,
        ForemanTab.OVERTIME to strings.tabOvertime,
        ForemanTab.NOTIFICATIONS to strings.notifications,
        ForemanTab.SETTINGS to strings.settings,
    )

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = colors.tabBar, tonalElevation = 0.dp) {
                ForemanTab.entries.forEach { tab ->
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when (selected) {
                ForemanTab.DASHBOARD -> ForemanDashboardScreen(appVm = appVm, container = container)
                ForemanTab.BRIGADES -> BrigadesScreen(container = container)
                ForemanTab.ATTENDANCE -> ForemanAttendanceScreen(container = container)
                ForemanTab.OVERTIME -> OvertimeScreen(container = container, appVm = appVm)
                ForemanTab.NOTIFICATIONS -> NotificationsScreen(container = container)
                ForemanTab.SETTINGS -> SettingsScreen(appVm = appVm, onLogout = onLogout)
            }
        }
    }
}
