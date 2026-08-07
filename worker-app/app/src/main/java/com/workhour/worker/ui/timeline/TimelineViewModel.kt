package com.workhour.worker.ui.timeline

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.local.db.AppDatabase
import com.workhour.worker.data.local.db.ScanEventEntity
import com.workhour.worker.data.model.ScanEvent
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class TimelineUiState(
    val loading: Boolean = true,
    val error: String = "",
    val events: List<ScanEvent> = emptyList(),
)

class TimelineViewModel(app: Application) : AndroidViewModel(app) {

    private val db = AppDatabase.get(app)

    private val _state = MutableStateFlow(TimelineUiState())
    val state: StateFlow<TimelineUiState> = _state.asStateFlow()

    fun load(serverUrl: String, workerEntityId: String) {
        viewModelScope.launch {
            // 1. Show cached scans immediately
            val cached = db.dao().getTodayScans(workerEntityId)
            if (cached.isNotEmpty()) {
                _state.update { it.copy(loading = false, events = cached.map { e -> e.toModel() }) }
            } else {
                _state.update { it.copy(loading = true, error = "") }
            }

            // 2. Fetch fresh from network
            try {
                val events = ApiClient.get(serverUrl).getTodayEvents()
                db.dao().clearScans(workerEntityId)
                if (events.isNotEmpty()) {
                    db.dao().insertScans(events.map { it.toEntity(workerEntityId) })
                }
                _state.update { it.copy(loading = false, error = "", events = events) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load") }
            }
        }
    }

    fun refresh(serverUrl: String, workerEntityId: String) = load(serverUrl, workerEntityId)
}

private fun ScanEventEntity.toModel() = ScanEvent(eventType, eventTime, source)
private fun ScanEvent.toEntity(wid: String) = ScanEventEntity(wid, eventType, eventTime, source ?: "NFC")
