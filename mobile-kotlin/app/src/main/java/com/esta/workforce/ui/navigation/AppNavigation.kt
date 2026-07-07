package com.esta.workforce.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.esta.workforce.AppContainer
import com.esta.workforce.data.model.UserRole
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.auth.LoginScreen
import com.esta.workforce.ui.foreman.ForemanMain
import com.esta.workforce.ui.sitechief.SiteChiefMain

@Composable
fun AppNavigation(appVm: AppViewModel, container: AppContainer) {
    val navController = rememberNavController()
    val user by appVm.user.collectAsState()

    val startDest = if (user != null) {
        if (user!!.role == UserRole.FOREMAN) "foreman" else "sitechief"
    } else "login"

    NavHost(navController = navController, startDestination = startDest) {
        composable("login") {
            LoginScreen(
                container = container,
                onLoginSuccess = { role ->
                    val dest = if (role == UserRole.FOREMAN) "foreman" else "sitechief"
                    navController.navigate(dest) {
                        popUpTo("login") { inclusive = true }
                    }
                },
                appVm = appVm,
            )
        }
        composable("foreman") {
            ForemanMain(
                appVm = appVm,
                container = container,
                onLogout = {
                    appVm.logout()
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable("sitechief") {
            SiteChiefMain(
                appVm = appVm,
                container = container,
                onLogout = {
                    appVm.logout()
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
    }
}
