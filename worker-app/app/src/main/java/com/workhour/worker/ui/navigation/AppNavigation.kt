package com.workhour.worker.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.ui.calendar.CalendarScreen
import com.workhour.worker.ui.home.HomeScreen
import com.workhour.worker.ui.profile.ProfileScreen
import com.workhour.worker.ui.settings.SettingsScreen
import com.workhour.worker.ui.theme.*
import com.workhour.worker.ui.timeline.TimelineScreen

private data class Tab(
    val route: String,
    val labelKey: (AppStrings) -> String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

private val TABS = listOf(
    Tab("home",     { it.home },     Icons.Filled.Home,          Icons.Outlined.Home),
    Tab("calendar", { it.calendar }, Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth),
    Tab("timeline", { it.timeline }, Icons.Filled.Timeline,      Icons.Outlined.Timeline),
    Tab("settings", { it.settings }, Icons.Filled.Settings,      Icons.Outlined.Settings),
    Tab("profile",  { it.profile },  Icons.Filled.Person,        Icons.Outlined.Person),
)

@Composable
fun MainNavigation(serverUrl: String, user: SavedUser, onLogout: () -> Unit) {
    val s = LocalStrings.current
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    Scaffold(
        containerColor = BgDeep,
        bottomBar = {
            NavigationBar(
                containerColor = BgSurface,
                tonalElevation = 0.dp,
            ) {
                TABS.forEach { tab ->
                    val selected = currentRoute == tab.route
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState    = true
                            }
                        },
                        icon  = { Icon(if (selected) tab.selectedIcon else tab.unselectedIcon, tab.labelKey(s)) },
                        label = { Text(tab.labelKey(s), style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor   = AccentPurple,
                            selectedTextColor   = AccentPurple,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor      = AccentPurpleDim.copy(0.2f),
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController    = navController,
            startDestination = "home",
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(BgDeep),
        ) {
            composable("home")     { HomeScreen(serverUrl, user.name) }
            composable("calendar") { CalendarScreen(serverUrl) }
            composable("timeline") { TimelineScreen(serverUrl) }
            composable("settings") { SettingsScreen(serverUrl) }
            composable("profile")  { ProfileScreen(serverUrl, user, onLogout) }
        }
    }
}
