package com.workhour.worker.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class HistoryUiState(
    val loading: Boolean = true,
    val error: String = "",
    val month: String = "",          // "YYYY-MM"
    val records: List<AttendanceRecord> = emptyList(),
    val presentDays: Int = 0,
    val totalMinutes: Int = 0,
)

class HistoryViewModel : ViewModel() {

    private val _state = MutableStateFlow(HistoryUiState())
    val state: StateFlow<HistoryUiState> = _state.asStateFlow()

    private val monthFmt = SimpleDateFormat("yyyy-MM", Locale.US)
    private val dateFmt  = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun load(serverUrl: String, month: String? = null) {
        val m = month ?: monthFmt.format(Date())
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "", month = m) }
            try {
                val summary = ApiClient.get(serverUrl).getMonthSummary(m)
                _state.update {
                    it.copy(
                        loading      = false,
                        records      = summary.records,
                        presentDays  = summary.presentDays,
                        totalMinutes = summary.totalMinutes,
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load") }
            }
        }
    }

    fun prevMonth(serverUrl: String) {
        val cal = Calendar.getInstance()
        cal.time = SimpleDateFormat("yyyy-MM", Locale.US).parse(_state.value.month)!!
        cal.add(Calendar.MONTH, -1)
        load(serverUrl, monthFmt.format(cal.time))
    }

    fun nextMonth(serverUrl: String) {
        val cal = Calendar.getInstance()
        cal.time = SimpleDateFormat("yyyy-MM", Locale.US).parse(_state.value.month)!!
        cal.add(Calendar.MONTH, 1)
        val next = monthFmt.format(cal.time)
        val now  = monthFmt.format(Date())
        if (next <= now) load(serverUrl, next)
    }
}
