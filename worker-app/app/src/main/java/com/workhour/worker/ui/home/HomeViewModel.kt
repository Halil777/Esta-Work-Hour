package com.workhour.worker.ui.home

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

data class HomeUiState(
    val loading: Boolean = true,
    val error: String = "",
    val today: AttendanceRecord? = null,
    val week: List<AttendanceRecord> = emptyList(),
    val workerName: String = "",
)

class HomeViewModel(app: Application) : AndroidViewModel(app) {

    private val db  = AppDatabase.get(app)
    private val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    fun load(serverUrl: String, workerEntityId: String, workerName: String) {
        val todayStr     = sdf.format(Date())
        val cal          = Calendar.getInstance().also { it.add(Calendar.DAY_OF_YEAR, -6) }
        val weekStartStr = sdf.format(cal.time)

        viewModelScope.launch {
            _state.update { it.copy(workerName = workerName) }

            // 1. Show cached data immediately (instant display)
            val cached = db.dao().getAttendanceRange(workerEntityId, weekStartStr, todayStr)
            if (cached.isNotEmpty()) {
                val records = cached.map { it.toModel() }
                _state.update {
                    it.copy(
                        loading = false,
                        today   = records.firstOrNull { r -> r.date == todayStr },
                        week    = records.sortedBy { r -> r.date },
                    )
                }
            } else {
                _state.update { it.copy(loading = true) }
            }

            // 2. Fetch fresh from network and update cache
            try {
                val records = ApiClient.get(serverUrl).getAttendance(weekStartStr, todayStr)
                db.dao().upsertAttendance(records.map { it.toEntity(workerEntityId) })
                _state.update {
                    it.copy(
                        loading = false,
                        error   = "",
                        today   = records.firstOrNull { it.date == todayStr },
                        week    = records.sortedBy { it.date },
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load") }
            }
        }
    }

    fun refresh(serverUrl: String, workerEntityId: String, workerName: String) =
        load(serverUrl, workerEntityId, workerName)
}

private fun AttendanceRecordEntity.toModel() =
    AttendanceRecord(date, checkIn, checkOut, totalMinutes, status)

private fun AttendanceRecord.toEntity(wid: String) =
    AttendanceRecordEntity(wid, date, checkIn, checkOut, totalMinutes, status)
