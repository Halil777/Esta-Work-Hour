package com.esta.attendance.data.repository

import com.esta.attendance.data.local.dao.AttendanceEventDao
import com.esta.attendance.data.local.dao.CardDao
import com.esta.attendance.data.local.dao.WorkerDao
import com.esta.attendance.data.local.entity.AttendanceEvent
import com.esta.attendance.data.local.entity.Card
import com.esta.attendance.data.local.entity.Worker
import com.esta.attendance.data.local.model.AttendanceEventWithWorker
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit

class AttendanceRepository(
    private val workerDao: WorkerDao,
    private val cardDao: CardDao,
    private val attendanceEventDao: AttendanceEventDao
) {
    val allWorkers: Flow<List<Worker>> = workerDao.getAllWorkers()
    val allEventsWithWorker: Flow<List<AttendanceEventWithWorker>> =
        attendanceEventDao.getAllEventsWithWorker()

    suspend fun addWorker(worker: Worker): Long = workerDao.insertWorker(worker)

    suspend fun getWorkerById(id: Long): Worker? = workerDao.getWorkerById(id)

    suspend fun registerCard(card: Card): Long = cardDao.insertCard(card)

    suspend fun processCardTap(
        cardUid: String,
        eventMode: String,
        latitude: Double,
        longitude: Double,
    ): String {
        // Try direct hex-colon match first, then decimal equivalent
        val card = cardDao.getActiveCardByUid(cardUid)
            ?: cardDao.getActiveCardByUid(uidHexToDecimal(cardUid) ?: "")
            ?: return "UNKNOWN_CARD"

        val event = AttendanceEvent(
            workerId = card.workerId,
            cardUid = cardUid,
            eventType = eventMode,
            latitude = latitude,
            longitude = longitude
        )
        attendanceEventDao.insertEvent(event)

        val worker = workerDao.getWorkerById(card.workerId)
        return "${worker?.fullName ?: "Unknown"} - $eventMode"
    }

    private fun uidHexToDecimal(hexUid: String): String? {
        return try {
            val bytes = hexUid.split(":").map { it.toInt(16).toByte() }.toByteArray()
            var result = 0L
            for (b in bytes) result = result * 256 + (b.toLong() and 0xFF)
            result.toString()
        } catch (e: Exception) { null }
    }

    suspend fun getPendingEvents(): List<AttendanceEventWithWorker> =
        attendanceEventDao.getPendingEventsWithWorker()

    suspend fun updateEventSyncStatus(eventId: Long, status: String) =
        attendanceEventDao.updateSyncStatus(eventId, status)

    /**
     * Deletes already-synced local history older than [retentionDays]. Local
     * storage is just a convenience cache/offline buffer — the backend is
     * the system of record — so trimming it doesn't lose anything, it just
     * keeps the on-device table (and the history screen's search) fast.
     */
    suspend fun purgeOldSyncedEvents(retentionDays: Int = 45): Int {
        val cutoff = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(retentionDays.toLong())
        return attendanceEventDao.purgeSyncedEventsBefore(cutoff)
    }

    /** Number of scans recorded locally but not yet confirmed synced — reported in the heartbeat. */
    suspend fun getPendingEventCount(): Int = attendanceEventDao.getPendingCount()
}
