package com.workhour.worker.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class HomeUiState(
    val loading: Boolean = true,
    val error: String = "",
    val today: AttendanceRecord? = null,
    val week: List<AttendanceRecord> = emptyList(),
    val workerName: String = "",
)

class HomeViewModel : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    private val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun load(serverUrl: String, workerName: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "", workerName = workerName) }
            try {
                val api      = ApiClient.get(serverUrl)
                val todayStr = sdf.format(Date())
                val cal      = Calendar.getInstance()
                cal.add(Calendar.DAY_OF_YEAR, -6)
                val weekStartStr = sdf.format(cal.time)

                val records = api.getAttendance(weekStartStr, todayStr)
                val todayRecord = records.firstOrNull { it.date == todayStr }
                // Week: last 7 days sorted ascending
                val weekRecords = records.sortedBy { it.date }

                _state.update { it.copy(loading = false, today = todayRecord, week = weekRecords) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load") }
            }
        }
    }

    fun refresh(serverUrl: String, workerName: String) = load(serverUrl, workerName)
}
