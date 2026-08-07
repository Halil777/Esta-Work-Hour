package com.workhour.worker.ui.timeline

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.model.ScanEvent
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class TimelineUiState(
    val loading: Boolean = true,
    val error: String = "",
    val events: List<ScanEvent> = emptyList(),
)

class TimelineViewModel : ViewModel() {

    private val _state = MutableStateFlow(TimelineUiState())
    val state: StateFlow<TimelineUiState> = _state.asStateFlow()

    fun load(serverUrl: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "") }
            try {
                val events = ApiClient.get(serverUrl).getTodayEvents()
                _state.update { it.copy(loading = false, events = events) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load") }
            }
        }
    }

    fun refresh(serverUrl: String) = load(serverUrl)
}
