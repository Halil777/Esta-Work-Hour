package com.esta.attendance

import android.util.Log
import com.esta.attendance.data.repository.AttendanceRepository
import com.esta.attendance.network.ApiService
import com.esta.attendance.network.dto.SyncEventRequest
import com.esta.attendance.network.dto.SyncPayload
import com.esta.attendance.network.dto.SyncWarning

class SyncManager(
    private val repository: AttendanceRepository,
    private val apiService: ApiService
) {
    var lastWarnings: List<SyncWarning> = emptyList()
        private set

    /**
     * Syncs all PENDING attendance events to the backend.
     * Returns Result<Int> — number of events synced, or failure.
     */
    suspend fun syncPendingEvents(): Result<Int> {
        return try {
            val pending = repository.getPendingEvents()
            if (pending.isEmpty()) return Result.success(0)

            val requests = pending.map { eventWithWorker ->
                val event = eventWithWorker.event
                val worker = eventWithWorker.worker
                SyncEventRequest(
                    localId = event.id,
                    workerServerId = null,
                    employeeNumber = worker?.employeeNumber ?: "",
                    cardUid = event.cardUid,
                    eventType = event.eventType,
                    eventTime = event.eventTime,
                    source = event.source,
                    latitude = event.latitude,
                    longitude = event.longitude
                )
            }

            val response = apiService.syncEvents(SyncPayload(requests))

            // Update local sync status based on server response
            response.results.forEach { result ->
                val newStatus = if (result.status == "SYNCED") "SYNCED" else "FAILED"
                repository.updateEventSyncStatus(result.localId, newStatus)
            }

            lastWarnings = response.warnings
            if (response.warnings.isNotEmpty()) {
                Log.w("SyncManager", "Cross-device warnings: ${response.warnings.size}")
            }

            Result.success(response.synced)
        } catch (e: Exception) {
            lastWarnings = emptyList()
            Log.e("SyncManager", "syncPendingEvents failed: ${e.javaClass.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }
}
