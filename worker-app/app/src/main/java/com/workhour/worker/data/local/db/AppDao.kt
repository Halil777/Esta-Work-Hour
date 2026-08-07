package com.workhour.worker.data.local.db

import androidx.room.*

@Dao
interface AppDao {

    @Query("SELECT * FROM attendance_records WHERE workerEntityId = :wid AND date >= :start AND date <= :end ORDER BY date ASC")
    suspend fun getAttendanceRange(wid: String, start: String, end: String): List<AttendanceRecordEntity>

    @Upsert
    suspend fun upsertAttendance(records: List<AttendanceRecordEntity>)

    @Query("SELECT * FROM scan_events WHERE workerEntityId = :wid ORDER BY eventTime ASC")
    suspend fun getTodayScans(wid: String): List<ScanEventEntity>

    @Query("DELETE FROM scan_events WHERE workerEntityId = :wid")
    suspend fun clearScans(wid: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertScans(scans: List<ScanEventEntity>)

    @Query("SELECT * FROM worker_profile WHERE id = :id LIMIT 1")
    suspend fun getProfile(id: String): WorkerProfileEntity?

    @Upsert
    suspend fun upsertProfile(profile: WorkerProfileEntity)
}
