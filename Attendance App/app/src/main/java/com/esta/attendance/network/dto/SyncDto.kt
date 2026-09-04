package com.esta.attendance.network.dto

data class SyncEventRequest(
    val localId: Long,
    val workerServerId: String?,  // backend UUID (null = worker not synced yet)
    val employeeNumber: String,
    val cardUid: String,
    val eventType: String,        // CHECK_IN / CHECK_OUT
    val eventTime: Long,
    val source: String,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class SyncPayload(
    val events: List<SyncEventRequest>
)

data class SyncEventResult(
    val localId: Long,
    val serverId: String?,
    val status: String            // SYNCED / FAILED
)

data class SyncWarning(
    val employeeNumber: String,
    val workerName: String,
    val type: String,           // "ALREADY_CHECKED_IN" / "ALREADY_CHECKED_OUT"
    val lastEventTime: Long,
)

data class SyncResponse(
    val synced: Int,
    val failed: Int,
    val results: List<SyncEventResult>,
    val warnings: List<SyncWarning> = emptyList(),
)
