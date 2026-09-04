package com.esta.attendance.network.dto

data class BackendWorker(
    val id: String,
    val workerId: String,
    val name: String,
    val profession: String?,
    val brigadeId: String?,
    val brigadeName: String?,
    val status: String,
    val phone: String?,
    val hireDate: String?,
    val nfcCardUid: String? = null,
    val shift: String? = null
)
