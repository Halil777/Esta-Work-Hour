package com.workhour.worker.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class CalendarUiState(
    val loading: Boolean = true,
    val error: String = "",
    val month: String = "",           // "YYYY-MM"
    val records: List<AttendanceRecord> = emptyList(),
    val selectedDate: String? = null, // "YYYY-MM-DD" or null
    val presentDays: Int = 0,
    val totalMinutes: Int = 0,
)

class CalendarViewModel : ViewModel() {

    private val _state = MutableStateFlow(CalendarUiState())
    val state: StateFlow<CalendarUiState> = _state.asStateFlow()

    private val monthFmt = SimpleDateFormat("yyyy-MM", Locale.US)

    fun load(serverUrl: String, month: String? = null) {
        val m = month ?: monthFmt.format(Date())
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "", month = m, selectedDate = null) }
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

    fun selectDate(date: String) {
        _state.update {
            it.copy(selectedDate = if (it.selectedDate == date) null else date)
        }
    }

    fun prevMonth(serverUrl: String) = shiftMonth(serverUrl, -1)
    fun nextMonth(serverUrl: String) = shiftMonth(serverUrl, +1)

    private fun shiftMonth(serverUrl: String, delta: Int) {
        val cal = Calendar.getInstance()
        cal.time = monthFmt.parse(_state.value.month) ?: Date()
        cal.add(Calendar.MONTH, delta)
        val next = monthFmt.format(cal.time)
        if (next <= monthFmt.format(Date())) load(serverUrl, next)
    }
}
