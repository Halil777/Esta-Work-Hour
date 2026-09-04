package com.esta.attendance.network.dto

data class CardReportRequest(
    val cardUid: String,
    val currentWorkerName: String?,
    val suggestedWorkerId: String?,
    val suggestedWorkerName: String?,
    val note: String?
)

data class CardReportResponse(
    val id: String,
    val status: String
)
