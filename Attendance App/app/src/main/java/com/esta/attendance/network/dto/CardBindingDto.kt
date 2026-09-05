package com.esta.attendance.network.dto

/**
 * Operator self-service card unbind/rebind — the replacement for the old
 * "report a wrong card to the admin" flow. Both calls are immediate and
 * authoritative: the server applies the change right away and records it
 * in the tenant's card-assignment history, no admin approval step.
 */

data class CardUnbindRequest(
    val workerId: String,
    val note: String? = null
)

data class CardAssignRequest(
    val cardUid: String,
    val workerId: String
)

/** Shared response shape for both /device/cards/unbind and /device/cards/assign. */
data class CardBindingResponse(
    val workerId: String,
    val name: String,
    val nfcCardUid: String?
)
