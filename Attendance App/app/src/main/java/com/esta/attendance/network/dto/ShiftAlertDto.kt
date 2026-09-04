package com.esta.attendance.network.dto

data class ShiftAlertWorker(
    val workerId: String,
    val name: String,
    val team: String?
)

data class ShiftAlertData(
    val startTime: String,
    val graceEndTime: String,
    val graceExpired: Boolean,
    val workers: List<ShiftAlertWorker>
)

data class ShiftAlertsResponse(
    val day: ShiftAlertData,
    val night: ShiftAlertData,
    val totalActive: Int,
    val scannedToday: Int
)

data class ShiftChangeRequest(
    val shift: String
)

data class ShiftChangeResponse(
    val id: String,
    val workerId: String,
    val name: String,
    val shift: String?
)
