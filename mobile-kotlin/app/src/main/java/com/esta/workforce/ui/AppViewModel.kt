package com.esta.workforce.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.esta.workforce.data.local.PrefsDataStore
import com.esta.workforce.data.model.AppTheme
import com.esta.workforce.data.model.AppUser
import com.esta.workforce.data.model.Language
import com.esta.workforce.data.model.MobileWorker
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.data.network.TokenProvider
import com.esta.workforce.ui.theme.AppStrings
import com.esta.workforce.ui.theme.getStrings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModel(
    private val prefs: PrefsDataStore,
    private val api: ApiService,
) : ViewModel() {

    val user: StateFlow<AppUser?> = prefs.userFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val token: StateFlow<String?> = prefs.tokenFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val language: StateFlow<Language> = prefs.languageFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, Language.RU)

    val theme: StateFlow<AppTheme> = prefs.themeFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppTheme.DARK)

    val strings: StateFlow<AppStrings> = language
        .map { lang -> getStrings(lang) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, getStrings(Language.RU))

    private val _cachedWorkers = MutableStateFlow<List<MobileWorker>>(emptyList())
    val cachedWorkers: StateFlow<List<MobileWorker>> = _cachedWorkers

    // NFC — scanned card UID (consumed after use)
    private val _nfcUid = MutableStateFlow<String?>(null)
    val nfcUid: StateFlow<String?> = _nfcUid

    fun emitNfcUid(uid: String) { _nfcUid.value = uid }
    fun consumeNfcUid() { _nfcUid.value = null }

    suspend fun getCardMap(): Map<String, String> = prefs.getCardMap()

    fun saveCardMapping(uid: String, entityId: String) {
        viewModelScope.launch { prefs.saveCardMapping(uid, entityId) }
    }

    init {
        viewModelScope.launch {
            _cachedWorkers.value = prefs.getWorkersCache()
        }
        viewModelScope.launch {
            token.collect { t -> TokenProvider.setToken(t) }
        }
    }

    fun login(user: AppUser, token: String) {
        viewModelScope.launch {
            prefs.setUser(user)
            prefs.setToken(token)
            TokenProvider.setToken(token)
        }
    }

    fun logout() {
        viewModelScope.launch {
            prefs.setUser(null)
            prefs.setToken(null)
            prefs.clearWorkersCache()
            TokenProvider.setToken(null)
            _cachedWorkers.value = emptyList()
        }
    }

    fun setLanguage(lang: Language) {
        viewModelScope.launch { prefs.setLanguage(lang) }
    }

    fun toggleTheme() {
        viewModelScope.launch {
            val next = if (theme.value == AppTheme.DARK) AppTheme.LIGHT else AppTheme.DARK
            prefs.setTheme(next)
        }
    }

    fun refreshWorkers() {
        viewModelScope.launch {
            try {
                val workers = api.getMyWorkers()
                _cachedWorkers.value = workers
                prefs.setWorkersCache(workers)
            } catch (_: Exception) {}
        }
    }

    companion object {
        fun factory(prefs: PrefsDataStore, api: ApiService): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { AppViewModel(prefs, api) }
            }
    }
}
