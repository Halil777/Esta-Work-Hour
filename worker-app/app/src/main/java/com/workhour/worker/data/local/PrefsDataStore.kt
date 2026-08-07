package com.workhour.worker.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.ui.theme.AppLanguage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "wh_prefs")

class PrefsDataStore(context: Context) {

    private val store = context.dataStore
    private val gson  = Gson()

    companion object {
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_TOKEN      = stringPreferencesKey("token")
        private val KEY_USER       = stringPreferencesKey("user")
        private val KEY_LANGUAGE   = stringPreferencesKey("language")
    }

    val serverUrlFlow: Flow<String?> = store.data.map { it[KEY_SERVER_URL] }
    val tokenFlow: Flow<String?>     = store.data.map { it[KEY_TOKEN] }
    val userFlow: Flow<SavedUser?>   = store.data.map { prefs ->
        prefs[KEY_USER]?.let {
            try { gson.fromJson(it, SavedUser::class.java) } catch (_: Exception) { null }
        }
    }
    val languageFlow: Flow<AppLanguage> = store.data.map { prefs ->
        when (prefs[KEY_LANGUAGE]) {
            "RU" -> AppLanguage.RU
            "TR" -> AppLanguage.TR
            else -> AppLanguage.EN
        }
    }

    suspend fun getServerUrl() = store.data.first()[KEY_SERVER_URL]
    suspend fun getToken()     = store.data.first()[KEY_TOKEN]

    suspend fun setServerUrl(url: String) = store.edit { it[KEY_SERVER_URL] = url.trimEnd('/') }

    suspend fun setSession(token: String, user: SavedUser) {
        store.edit { prefs ->
            prefs[KEY_TOKEN] = token
            prefs[KEY_USER]  = gson.toJson(user)
        }
    }

    suspend fun setLanguage(lang: AppLanguage) = store.edit { it[KEY_LANGUAGE] = lang.name }

    suspend fun clearSession() {
        store.edit { prefs ->
            prefs.remove(KEY_TOKEN)
            prefs.remove(KEY_USER)
        }
    }
}
