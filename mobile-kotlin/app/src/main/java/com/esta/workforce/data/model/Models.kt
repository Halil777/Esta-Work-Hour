package com.esta.workforce.data.model

import com.google.gson.annotations.SerializedName

// ─── Auth ─────────────────────────────────────────────────────────────────────

data class LoginRequest(val username: String, val password: String)

data class LoginResponse(
    @SerializedName("access_token") val accessToken: String,
    val role: String,
    val name: String,
    @SerializedName("workerEntityId") val workerEntityId: String,
)

// ─── Worker ───────────────────────────────────────────────────────────────────

data class MobileWorker(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeName: String?,
    val mesaiSistemi: String?,
    val mobileRole: String?,
    val extraSaat: Any?,
    val shift: String?,
    val lastCheckIn: Long?,
    val lastCheckOut: Long?,
    val todayHoursMs: Long?,
)

data class UnassignedWorker(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeName: String?,
    val mesaiSistemi: String?,
    val status: String?,
)

data class SiteChiefOption(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
)

// Worker resolved by NFC card scan (mobile/foreman/workers/by-card) — used
// only to build an extra-hours request, never an attendance check-in/out.
data class CardWorker(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeName: String?,
    val foremanId: String?,
)

// ─── Request bodies ───────────────────────────────────────────────────────────

data class ClaimBulkRequest(val workerIds: List<String>, val shift: String?)
data class SetShiftRequest(val shift: String)
data class AbsenceNoteRequest(val workerEntityId: String, val date: String, val note: String)
data class ActionRequest(val action: String)
data class PushTokenRequest(val pushToken: String)

// ─── Extra Hours ──────────────────────────────────────────────────────────────

data class ExtraHoursRequestItem(
    val id: String,
    val workerEntityId: String,
    val workerName: String,
    val workerId: String,
    val extraHours: Double,
    val description: String?,
)

// One row per site chief the request was sent to — each tracks their own
// seen/action independently. See ExtraHoursRequest.status doc below for how
// these roll up into the overall status.
data class ExtraHoursRequestRecipient(
    val id: String,
    val siteChiefWorkerEntityId: String,
    val siteChiefName: String,
    val seenAt: String?,
    val action: String, // "pending" | "approved" | "rejected"
    val actionAt: String?,
)

data class ExtraHoursRequest(
    val id: String,
    val foremanWorkerEntityId: String,
    val foremanName: String,
    val workDate: String,
    val note: String?,
    // Overall/aggregate status: any one recipient's approval settles this as
    // "approved" for everyone; "rejected" only once every recipient has
    // rejected it — until then it stays "pending". See each recipient's own
    // `action` in `recipients` for who has/hasn't responded yet.
    val status: String, // "pending" | "seen" | "approved" | "rejected"
    val sentAt: String,
    val seenAt: String?,
    val actionAt: String?,
    val items: List<ExtraHoursRequestItem>,
    val recipients: List<ExtraHoursRequestRecipient>,
)

data class CreateExtraRequestItem(
    val workerEntityId: String,
    val extraHours: Double,
    val description: String?,
)

data class CreateExtraRequest(
    // Sent to one, several, or every site chief at once.
    val siteChiefWorkerEntityIds: List<String>,
    val workDate: String,
    val note: String?,
    val items: List<CreateExtraRequestItem>,
)

// ─── Notifications ────────────────────────────────────────────────────────────

data class LateArrivalAbsenceNote(
    val note: String,
    val createdByName: String,
    val createdBy: String,
)

data class LateArrival(
    val workerEntityId: String,
    val workerName: String,
    val workerId: String,
    val profession: String?,
    val brigadeName: String?,
    val shift: String?,
    val isStaff: Boolean,
    val absenceNote: LateArrivalAbsenceNote?,
)

data class MissingCheckout(
    val workerEntityId: String,
    val workerName: String,
    val workerId: String,
    val profession: String?,
    val brigadeName: String?,
    val checkInTime: Long,
    val hoursAgo: Double,
    val foremanWorkerEntityId: String?,
)

data class ShiftSetting(
    val id: String,
    val shiftType: String,    // "day" | "night"
    val startTime: String,    // HH:mm
    val endTime: String,      // HH:mm
    val graceMinutes: Int,
)

data class ShiftSettings(
    val startTime: String,
    val graceMinutes: Int?,
)

data class LateArrivalsResponse(
    val workers: List<LateArrival>,
    val daySettings: ShiftSettings?,
    val nightSettings: ShiftSettings?,
    val date: String,
)

// ─── App State ────────────────────────────────────────────────────────────────

data class AppUser(
    val id: String,
    val name: String,
    val role: UserRole,
    val objectName: String,
)

enum class UserRole { FOREMAN, SITE_CHIEF }
enum class AppTheme { DARK, LIGHT }
enum class Language { RU, EN, TK }
