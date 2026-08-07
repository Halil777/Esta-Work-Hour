package com.workhour.worker.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attendance_records", primaryKeys = ["workerEntityId", "date"])
data class AttendanceRecordEntity(
    val workerEntityId: String,
    val date: String,
    val checkIn: Long?,
    val checkOut: Long?,
    val totalMinutes: Int?,
    val status: String,
    val adminCorrected: Boolean = false,
    val originalCheckIn: Long? = null,
    val originalCheckOut: Long? = null,
)

@Entity(tableName = "scan_events", primaryKeys = ["workerEntityId", "eventTime", "eventType"])
data class ScanEventEntity(
    val workerEntityId: String,
    val eventType: String,
    val eventTime: Long,
    val source: String,
)

@Entity(tableName = "worker_profile")
data class WorkerProfileEntity(
    @PrimaryKey val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeName: String?,
    val shift: String?,
    val mesaiSistemi: String?,
    val status: String,
    val mobileRole: String,
)
