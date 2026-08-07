package com.workhour.worker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.ui.AppUiState
import com.workhour.worker.ui.AppViewModel
import com.workhour.worker.ui.auth.LoginScreen
import com.workhour.worker.ui.auth.SetupScreen
import com.workhour.worker.ui.navigation.MainNavigation
import com.workhour.worker.ui.theme.AccentPurple
import com.workhour.worker.ui.theme.WorkHourTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { App() }
    }
}

@Composable
private fun App() {
    val vm        : AppViewModel = viewModel()
    val state     by vm.state.collectAsStateWithLifecycle()
    val serverUrl by vm.serverUrl.collectAsStateWithLifecycle()
    val language  by vm.language.collectAsStateWithLifecycle()
    val theme     by vm.theme.collectAsStateWithLifecycle()

    WorkHourTheme(language = language, theme = theme) {
        val bgColor = com.workhour.worker.ui.theme.LocalAppColors.current.bgDeep
        when (val s = state) {
            is AppUiState.Loading -> Box(
                modifier = Modifier.fillMaxSize().background(bgColor),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = AccentPurple)
            }

            is AppUiState.NeedSetup -> SetupScreen(
                onSave = { url -> vm.saveServerUrl(url) }
            )

            is AppUiState.NeedLogin -> LoginScreen(
                serverUrl     = serverUrl ?: "",
                onLoggedIn    = { token, user -> vm.saveSession(token, user, serverUrl ?: "") },
                onChangeServer = { vm.saveServerUrl("") },
            )

            is AppUiState.LoggedIn -> MainNavigation(
                serverUrl = s.serverUrl,
                user      = s.user,
                onLogout  = { vm.logout() },
            )
        }
    }
}
