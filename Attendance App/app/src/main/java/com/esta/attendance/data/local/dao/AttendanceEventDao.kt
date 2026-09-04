package com.esta.attendance.data.local.dao

import androidx.room.*
import com.esta.attendance.data.local.entity.AttendanceEvent
import com.esta.attendance.data.local.model.AttendanceEventWithWorker
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceEventDao {

    @Transaction
    @Query("SELECT * FROM attendance_events ORDER BY eventTime DESC")
    fun getAllEventsWithWorker(): Flow<List<AttendanceEventWithWorker>>

    @Transaction
    @Query("SELECT * FROM attendance_events WHERE syncStatus = 'PENDING' ORDER BY eventTime ASC")
    suspend fun getPendingEventsWithWorker(): List<AttendanceEventWithWorker>

    @Query("SELECT * FROM attendance_events WHERE workerId = :workerId ORDER BY eventTime DESC LIMIT 1")
    suspend fun getLastEventForWorker(workerId: Long): AttendanceEvent?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: AttendanceEvent): Long

    @Query("UPDATE attendance_events SET syncStatus = :status WHERE id = :id")
    suspend fun updateSyncStatus(id: Long, status: String)

    @Update
    suspend fun updateEvent(event: AttendanceEvent)

    // Local history is never fetched back from the server — it only ever
    // grows — so without a purge the device keeps every scan it has ever
    // made forever, slowing the history screen's search and the initial
    // Flow load as months go by. Only rows already confirmed SYNCED are
    // eligible, so nothing not-yet-uploaded is ever at risk.
    @Query("DELETE FROM attendance_events WHERE syncStatus = 'SYNCED' AND eventTime < :beforeMillis")
    suspend fun purgeSyncedEventsBefore(beforeMillis: Long): Int

    // Cheap count for the heartbeat payload — avoids loading full
    // event+worker rows just to report how many are waiting.
    @Query("SELECT COUNT(*) FROM attendance_events WHERE syncStatus = 'PENDING'")
    suspend fun getPendingCount(): Int
}
