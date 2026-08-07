package com.workhour.worker.data.network

import com.workhour.worker.data.model.*
import retrofit2.http.*

interface ApiService {

    // ─── Auth ─────────────────────────────────────────────────────────────────
    @POST("mobile/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    // ─── Worker self-service ──────────────────────────────────────────────────
    @GET("mobile/worker/me")
    suspend fun getMyProfile(): WorkerProfile

    @GET("mobile/worker/attendance")
    suspend fun getAttendance(
        @Query("startDate") startDate: String,
        @Query("endDate") endDate: String,
    ): List<AttendanceRecord>

    @GET("mobile/worker/month-summary")
    suspend fun getMonthSummary(
        @Query("month") month: String,
    ): MonthSummary

    @GET("mobile/worker/today-events")
    suspend fun getTodayEvents(): List<ScanEvent>

    @PATCH("mobile/worker/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequest)
}
