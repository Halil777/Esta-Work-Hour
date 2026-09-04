package com.esta.attendance.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

// employeeNumber is looked up on almost every worker-sync tick (see
// WorkerSyncManager) and on every local card lookup — without an index those
// were full table scans. Marking it unique is safe alongside WorkerDao's
// existing OnConflictStrategy.REPLACE inserts: if two syncs ever raced and
// produced a genuine duplicate, REPLACE resolves it instead of crashing or
// silently letting duplicates accumulate.
@Entity(tableName = "workers", indices = [Index(value = ["employeeNumber"], unique = true)])
data class Worker(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val fullName: String,
    val employeeNumber: String,
    val position: String,
    val team: String,
    val isActive: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
