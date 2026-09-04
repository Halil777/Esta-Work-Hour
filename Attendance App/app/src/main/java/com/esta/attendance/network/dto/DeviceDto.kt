package com.esta.attendance.network.dto

data class DeviceSetupRequest(
    val username: String,
    val password: String,
)

data class DeviceSetupResponse(
    val deviceToken: String,
    val tenantName: String,
    val tenantLogoUrl: String?,
    val deviceLabel: String,
    val deviceLocation: String?,
    val operatorName: String,
)

data class DeviceInfoResponse(
    val tenantName: String,
    val tenantLogoUrl: String?,
    val deviceLabel: String,
    val deviceLocation: String?,
    val operatorName: String?,
)

data class HeartbeatRequest(
    val batteryLevel: Int?,
    val appVersion: String?,
    val pendingEventCount: Int?,
)

data class HeartbeatResponse(
    val success: Boolean,
)
