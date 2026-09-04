package com.esta.attendance.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "attendance_events",
    foreignKeys = [
        ForeignKey(
            entity = Worker::class,
            parentColumns = ["id"],
            childColumns = ["workerId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["workerId"])]
)
data class AttendanceEvent(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "workerId") val workerId: Long,
    val cardUid: String,
    val eventType: String, // CHECK_IN / CHECK_OUT
    val eventTime: Long = System.currentTimeMillis(),
    val source: String = "NFC",
    val syncStatus: String = "PENDING", // PENDING / SYNCED / FAILED
    val createdAt: Long = System.currentTimeMillis(),
    val syncedAt: Long? = null,
    // Nullable for older rows created before location became mandatory.
    // New scan events are blocked until coordinates are available.
    val latitude: Double? = null,
    val longitude: Double? = null
)
