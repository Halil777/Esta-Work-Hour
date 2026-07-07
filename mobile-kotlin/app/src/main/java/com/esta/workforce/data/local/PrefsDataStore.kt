package com.esta.workforce.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.esta.workforce.data.model.AppTheme
import com.esta.workforce.data.model.AppUser
import com.esta.workforce.data.model.Language
import com.esta.workforce.data.model.MobileWorker
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.appPrefsDataStore: DataStore<Preferences> by preferencesDataStore(name = "app_prefs")

class PrefsDataStore(context: Context) {

    private val store = context.appPrefsDataStore
    private val gson = Gson()

    companion object {
        private val KEY_USER = stringPreferencesKey("user")
        private val KEY_TOKEN = stringPreferencesKey("token")
        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_THEME = stringPreferencesKey("theme")
        private val KEY_WORKERS = stringPreferencesKey("workers_cache")
        private val KEY_CARD_MAP = stringPreferencesKey("card_map")
    }

    val userFlow: Flow<AppUser?> = store.data.map { prefs ->
        prefs[KEY_USER]?.let {
            try { gson.fromJson(it, AppUser::class.java) } catch (e: Exception) { null }
        }
    }

    val tokenFlow: Flow<String?> = store.data.map { it[KEY_TOKEN] }

    val languageFlow: Flow<Language> = store.data.map { prefs ->
        when (prefs[KEY_LANGUAGE]) {
            "EN" -> Language.EN
            "TK" -> Language.TK
            else -> Language.RU
        }
    }

    val themeFlow: Flow<AppTheme> = store.data.map { prefs ->
        if (prefs[KEY_THEME] == "LIGHT") AppTheme.LIGHT else AppTheme.DARK
    }

    suspend fun setUser(user: AppUser?) {
        store.edit { prefs ->
            if (user != null) prefs[KEY_USER] = gson.toJson(user)
            else prefs.remove(KEY_USER)
        }
    }

    suspend fun setToken(token: String?) {
        store.edit { prefs ->
            if (token != null) prefs[KEY_TOKEN] = token
            else prefs.remove(KEY_TOKEN)
        }
    }

    suspend fun setLanguage(lang: Language) {
        store.edit { it[KEY_LANGUAGE] = lang.name }
    }

    suspend fun setTheme(theme: AppTheme) {
        store.edit { it[KEY_THEME] = theme.name }
    }

    suspend fun setWorkersCache(workers: List<MobileWorker>) {
        store.edit { it[KEY_WORKERS] = gson.toJson(workers) }
    }

    suspend fun clearWorkersCache() {
        store.edit { it.remove(KEY_WORKERS) }
    }

    suspend fun getWorkersCache(): List<MobileWorker> {
        val json = store.data.first()[KEY_WORKERS] ?: return emptyList()
        return try {
            val type = object : TypeToken<List<MobileWorker>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getCardMap(): Map<String, String> {
        val json = store.data.first()[KEY_CARD_MAP] ?: return emptyMap()
        return try {
            val type = object : TypeToken<Map<String, String>>() {}.type
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) { emptyMap() }
    }

    suspend fun saveCardMapping(uid: String, entityId: String) {
        store.edit { prefs ->
            val current: Map<String, String> = prefs[KEY_CARD_MAP]?.let { json ->
                try {
                    val type = object : TypeToken<Map<String, String>>() {}.type
                    gson.fromJson(json, type) ?: emptyMap()
                } catch (e: Exception) { emptyMap() }
            } ?: emptyMap()
            prefs[KEY_CARD_MAP] = gson.toJson(current + (uid to entityId))
        }
    }
}
