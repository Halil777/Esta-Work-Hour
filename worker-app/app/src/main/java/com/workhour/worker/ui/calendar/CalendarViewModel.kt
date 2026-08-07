package com.workhour.worker.ui.calendar

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.local.db.AppDatabase
import com.workhour.worker.data.local.db.AttendanceRecordEntity
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class CalendarUiState(
    val loading: Boolean = true,
    val error: String = "",
    val month: String = "",
    val records: List<AttendanceRecord> = emptyList(),
    val selectedDate: String? = null,
    val presentDays: Int = 0,
    val totalMinutes: Int = 0,
)

class CalendarViewModel(app: Application) : AndroidViewModel(app) {

    private val db       = AppDatabase.get(app)
    private val monthFmt = SimpleDateFormat("yyyy-MM", Locale.US)
    private val dateFmt  = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private val _state = MutableStateFlow(CalendarUiState())
    val state: StateFlow<CalendarUiState> = _state.asStateFlow()

    fun load(serverUrl: String, workerEntityId: String, month: String? = null) {
        val m = month ?: monthFmt.format(Date())
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "", month = m, selectedDate = null) }

            val (startDate, endDate) = monthRange(m)

            // 1. Show cached data immediately
            val cached = db.dao().getAttendanceRange(workerEntityId, startDate, endDate)
            if (cached.isNotEmpty()) {
                val records = cached.map { it.toModel() }
                _state.update {
                    it.copy(
                        loading      = false,
                        records      = records,
                        presentDays  = records.count { it.status != "absent" },
                        totalMinutes = records.sumOf { it.totalMinutes ?: 0 },
                    )
                }
            }

            // 2. Fetch fresh from network
            try {
                val summary = ApiClient.get(serverUrl).getMonthSummary(m)
                db.dao().upsertAttendance(summary.records.map { it.toEntity(workerEntityId) })
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
        _state.update { it.copy(selectedDate = if (it.selectedDate == date) null else date) }
    }

    fun prevMonth(serverUrl: String, workerEntityId: String) = shiftMonth(serverUrl, workerEntityId, -1)
    fun nextMonth(serverUrl: String, workerEntityId: String) = shiftMonth(serverUrl, workerEntityId, +1)

    private fun shiftMonth(serverUrl: String, workerEntityId: String, delta: Int) {
        val cal = Calendar.getInstance()
        cal.time = monthFmt.parse(_state.value.month) ?: Date()
        cal.add(Calendar.MONTH, delta)
        val next = monthFmt.format(cal.time)
        if (next <= monthFmt.format(Date())) load(serverUrl, workerEntityId, next)
    }

    private fun monthRange(month: String): Pair<String, String> {
        val cal = Calendar.getInstance()
        cal.time = monthFmt.parse(month) ?: Date()
        val startDate = dateFmt.format(cal.time.also { cal.set(Calendar.DAY_OF_MONTH, 1) })
        cal.add(Calendar.MONTH, 1)
        cal.add(Calendar.DAY_OF_MONTH, -1)
        return Pair("$month-01", dateFmt.format(cal.time))
    }
}

private fun AttendanceRecordEntity.toModel() =
    AttendanceRecord(date, checkIn, checkOut, totalMinutes, status)

private fun AttendanceRecord.toEntity(wid: String) =
    AttendanceRecordEntity(wid, date, checkIn, checkOut, totalMinutes, status)
