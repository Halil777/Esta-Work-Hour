package com.workhour.worker.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.local.PrefsDataStore
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.data.network.TokenHolder
import com.workhour.worker.ui.theme.AppLanguage
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed interface AppUiState {
    data object Loading   : AppUiState
    data object NeedSetup : AppUiState
    data object NeedLogin : AppUiState
    data class  LoggedIn(val user: SavedUser, val serverUrl: String) : AppUiState
}

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs = PrefsDataStore(app)

    private val _state = MutableStateFlow<AppUiState>(AppUiState.Loading)
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    val serverUrl: StateFlow<String?> = prefs.serverUrlFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val language: StateFlow<AppLanguage> = prefs.languageFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppLanguage.EN)

    init {
        viewModelScope.launch {
            combine(prefs.serverUrlFlow, prefs.tokenFlow, prefs.userFlow) { url, token, user ->
                when {
                    url.isNullOrBlank()                  -> AppUiState.NeedSetup
                    token.isNullOrBlank() || user == null -> AppUiState.NeedLogin
                    else -> {
                        TokenHolder.token = token
                        AppUiState.LoggedIn(user, url)
                    }
                }
            }.collect { _state.value = it }
        }
    }

    fun saveServerUrl(url: String) {
        viewModelScope.launch { prefs.setServerUrl(url) }
    }

    fun saveSession(token: String, user: SavedUser, serverUrl: String) {
        viewModelScope.launch {
            TokenHolder.token = token
            prefs.setServerUrl(serverUrl)
            prefs.setSession(token, user)
        }
    }

    fun setLanguage(lang: AppLanguage) {
        viewModelScope.launch { prefs.setLanguage(lang) }
    }

    fun logout() {
        viewModelScope.launch {
            TokenHolder.token = null
            prefs.clearSession()
        }
    }
}
