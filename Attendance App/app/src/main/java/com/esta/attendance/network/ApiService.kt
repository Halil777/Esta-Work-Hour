package com.esta.attendance.network

import com.esta.attendance.network.dto.BackendWorker
import com.esta.attendance.network.dto.CardReportRequest
import com.esta.attendance.network.dto.CardReportResponse
import com.esta.attendance.network.dto.DeviceInfoResponse
import com.esta.attendance.network.dto.DeviceSetupRequest
import com.esta.attendance.network.dto.DeviceSetupResponse
import com.esta.attendance.network.dto.HeartbeatRequest
import com.esta.attendance.network.dto.HeartbeatResponse
import com.esta.attendance.network.dto.ShiftAlertsResponse
import com.esta.attendance.network.dto.ShiftChangeRequest
import com.esta.attendance.network.dto.ShiftChangeResponse
import com.esta.attendance.network.dto.SyncPayload
import com.esta.attendance.network.dto.SyncResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    /** First-time setup: login with worker credentials → get device token */
    @POST("device/setup")
    suspend fun deviceSetup(@Body request: DeviceSetupRequest): DeviceSetupResponse

    /** Get current tenant/device info (requires device token in header) */
    @GET("device/info")
    suspend fun getDeviceInfo(): DeviceInfoResponse

    @POST("device/attendance/sync")
    suspend fun syncEvents(@Body payload: SyncPayload): SyncResponse

    @GET("device/workers")
    suspend fun getWorkers(): List<BackendWorker>

    @POST("device/card-reports")
    suspend fun submitCardReport(@Body request: CardReportRequest): CardReportResponse

    /** Periodic health check-in: battery, APK version, local unsynced count */
    @POST("device/heartbeat")
    suspend fun sendHeartbeat(@Body request: HeartbeatRequest): HeartbeatResponse

    /**
     * Tenant-wide (not per-device) stats + not-yet-scanned shift alerts —
     * every device polls the same server computation, so a worker who
     * scanned on another device is never shown as not-scanned here.
     */
    @GET("device/shift-alerts")
    suspend fun getShiftAlerts(): ShiftAlertsResponse

    /** Operator moves a worker between day/night shift from the device. */
    @POST("device/workers/{workerId}/shift")
    suspend fun changeWorkerShift(
        @Path("workerId") workerId: String,
        @Body request: ShiftChangeRequest
    ): ShiftChangeResponse
}
