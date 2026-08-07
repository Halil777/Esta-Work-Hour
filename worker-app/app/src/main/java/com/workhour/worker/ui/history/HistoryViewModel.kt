package com.workhour.worker.ui.history

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

data class HistoryUiState(
    val loading: Boolean = true,
    val error: String = "",
    val month: String = "",
    val records: List<AttendanceRecord> = emptyList(),
    val presentDays: Int = 0,
    val totalMinutes: Int = 0,
    val workerEntityId: String = "",
)

class HistoryViewModel(app: Application) : AndroidViewModel(app) {

    private val db       = AppDatabase.get(app)
    private val monthFmt = SimpleDateFormat("yyyy-MM", Locale.US)
    private val dateFmt  = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private val _state = MutableStateFlow(HistoryUiState())
    val state: StateFlow<HistoryUiState> = _state.asStateFlow()

    fun load(serverUrl: String, workerEntityId: String, month: String? = null) {
        val m = month ?: monthFmt.format(Date())
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = "", month = m, workerEntityId = workerEntityId) }

            val startDate = "$m-01"
            val cal = Calendar.getInstance().also {
                it.time = monthFmt.parse(m) ?: Date()
                it.add(Calendar.MONTH, 1)
                it.add(Calendar.DAY_OF_MONTH, -1)
            }
            val endDate = dateFmt.format(cal.time)

            // 1. Show cached data
            val cached = db.dao().getAttendanceRange(workerEntityId, startDate, endDate)
            if (cached.isNotEmpty()) {
                val records = cached.map { it.toModel() }
                _state.update {
                    it.copy(
                        loading      = false,
                        records      = records,
                        presentDays  = records.count { r -> r.status != "absent" },
                        totalMinutes = records.sumOf { r -> r.totalMinutes ?: 0 },
                    )
                }
            }

            // 2. Fetch from network
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

    fun prevMonth(serverUrl: String) {
        val cal = Calendar.getInstance()
        cal.time = monthFmt.parse(_state.value.month) ?: Date()
        cal.add(Calendar.MONTH, -1)
        load(serverUrl, _state.value.workerEntityId, monthFmt.format(cal.time))
    }

    fun nextMonth(serverUrl: String) {
        val cal = Calendar.getInstance()
        cal.time = monthFmt.parse(_state.value.month) ?: Date()
        cal.add(Calendar.MONTH, 1)
        val next = monthFmt.format(cal.time)
        if (next <= monthFmt.format(Date())) load(serverUrl, _state.value.workerEntityId, next)
    }
}

private fun AttendanceRecordEntity.toModel() =
    AttendanceRecord(date, checkIn, checkOut, totalMinutes, status)

private fun AttendanceRecord.toEntity(wid: String) =
    AttendanceRecordEntity(wid, date, checkIn, checkOut, totalMinutes, status)
