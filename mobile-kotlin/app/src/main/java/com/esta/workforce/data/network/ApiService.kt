package com.esta.workforce.data.network

import com.esta.workforce.data.model.*
import retrofit2.http.*

interface ApiService {

    // ─── Auth ─────────────────────────────────────────────────────────────────
    @POST("mobile/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    // ─── Foreman ──────────────────────────────────────────────────────────────
    @GET("mobile/foreman/workers")
    suspend fun getMyWorkers(): List<MobileWorker>

    @GET("mobile/foreman/unassigned-workers")
    suspend fun getUnassignedWorkers(): List<UnassignedWorker>

    @POST("mobile/foreman/workers/claim-bulk")
    suspend fun claimBulk(@Body body: ClaimBulkRequest): List<MobileWorker>

    @POST("mobile/foreman/workers/{id}/claim")
    suspend fun claimWorker(@Path("id") id: String): MobileWorker

    @DELETE("mobile/foreman/workers/{id}/release")
    suspend fun releaseWorker(@Path("id") id: String): MobileWorker

    @PATCH("mobile/foreman/workers/{id}/shift")
    suspend fun setShift(@Path("id") id: String, @Body body: SetShiftRequest): MobileWorker

    @GET("mobile/foreman/site-chiefs")
    suspend fun getSiteChiefs(): List<SiteChiefOption>

    @GET("mobile/foreman/extra-requests")
    suspend fun getForemanRequests(): List<ExtraHoursRequest>

    @POST("mobile/foreman/extra-requests")
    suspend fun createExtraRequest(@Body body: CreateExtraRequest): ExtraHoursRequest

    @GET("mobile/foreman/missing-checkouts")
    suspend fun getMissingCheckouts(): List<MissingCheckout>

    @GET("mobile/foreman/late-arrivals")
    suspend fun getLateArrivals(): LateArrivalsResponse

    @POST("mobile/foreman/absence-notes")
    suspend fun saveAbsenceNote(@Body body: AbsenceNoteRequest)

    // ─── Site Chief ───────────────────────────────────────────────────────────
    @GET("mobile/site-chief/extra-requests")
    suspend fun getSCRequests(): List<ExtraHoursRequest>

    @PATCH("mobile/site-chief/extra-requests/{id}/seen")
    suspend fun markSeen(@Path("id") id: String): ExtraHoursRequest

    @PATCH("mobile/site-chief/extra-requests/{id}/action")
    suspend fun takeAction(@Path("id") id: String, @Body body: ActionRequest): ExtraHoursRequest

    // ─── Shift Settings ───────────────────────────────────────────────────────
    @GET("shift-settings")
    suspend fun getShiftSettings(): List<com.esta.workforce.data.model.ShiftSetting>

    // ─── Push Token ───────────────────────────────────────────────────────────
    @POST("mobile/push-token")
    suspend fun savePushToken(@Body body: PushTokenRequest)
}
