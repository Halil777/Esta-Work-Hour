package com.esta.workforce.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.offlineQueueDataStore: DataStore<Preferences> by preferencesDataStore(name = "offline_queue")

class OfflineQueue(context: Context) {

    private val store = context.offlineQueueDataStore
    private val gson = Gson()
    private val KEY_QUEUE = stringPreferencesKey("queue")

    data class QueueItem(
        val id: String,
        val path: String,
        val method: String,
        val body: String?,
        val label: String,
        val enqueuedAt: Long,
    )

    private fun parseQueue(prefs: Preferences): List<QueueItem> {
        val json = prefs[KEY_QUEUE] ?: return emptyList()
        return try {
            val type = object : TypeToken<List<QueueItem>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    val queueFlow: Flow<List<QueueItem>> = store.data.map { parseQueue(it) }

    suspend fun add(path: String, method: String, body: Any?, label: String): String {
        val item = QueueItem(
            id = "${System.currentTimeMillis()}-${(1000..9999).random()}",
            path = path,
            method = method,
            body = body?.let { gson.toJson(it) },
            label = label,
            enqueuedAt = System.currentTimeMillis(),
        )
        store.edit { prefs ->
            val current = parseQueue(prefs)
            prefs[KEY_QUEUE] = gson.toJson(current + item)
        }
        return item.id
    }

    suspend fun getAll(): List<QueueItem> = parseQueue(store.data.first())

    suspend fun remove(id: String) {
        store.edit { prefs ->
            val current = parseQueue(prefs)
            prefs[KEY_QUEUE] = gson.toJson(current.filter { it.id != id })
        }
    }

    suspend fun clear() {
        store.edit { it.remove(KEY_QUEUE) }
    }
}
