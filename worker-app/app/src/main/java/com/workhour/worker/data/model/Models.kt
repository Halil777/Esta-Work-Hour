package com.workhour.worker.data.model

import com.google.gson.annotations.SerializedName

// ─── Auth ─────────────────────────────────────────────────────────────────────

data class LoginRequest(
    val username: String,
    val password: String,
)

data class LoginResponse(
    @SerializedName("access_token") val accessToken: String,
    val role: String,
    val name: String,
    @SerializedName("workerEntityId") val workerEntityId: String,
)

// ─── Worker Profile ───────────────────────────────────────────────────────────

data class WorkerProfile(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeName: String?,
    val shift: String?,        // "day" | "night" | null
    val mesaiSistemi: String?, // "Aylık" | "Saatlik" | null
    val status: String,
    val mobileRole: String,
)

// ─── Attendance ───────────────────────────────────────────────────────────────

data class AttendanceRecord(
    val date: String,          // "YYYY-MM-DD"
    val checkIn: Long?,        // Unix ms timestamp
    val checkOut: Long?,       // Unix ms timestamp
    val totalMinutes: Int?,
    val status: String,        // "present" | "partial" | "absent"
)

data class MonthSummary(
    val month: String,
    val presentDays: Int,
    val totalMinutes: Int,
    val records: List<AttendanceRecord>,
)

// ─── Settings ─────────────────────────────────────────────────────────────────

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)

// ─── Timeline ─────────────────────────────────────────────────────────────────

data class ScanEvent(
    val eventType: String,  // "CHECK_IN" | "CHECK_OUT"
    val eventTime: Long,    // Unix ms
    val source: String?,
)

// ─── App State ────────────────────────────────────────────────────────────────

data class SavedUser(
    val workerEntityId: String,
    val name: String,
    val role: String,
)
