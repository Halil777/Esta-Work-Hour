package com.esta.attendance.network

import android.content.Context
import com.esta.attendance.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    @Volatile
    private var cachedApiService: ApiService? = null
    @Volatile
    private var cachedBaseUrl: String? = null

    /**
     * Returns a shared ApiService, building the underlying OkHttpClient +
     * Retrofit only once per process. Every Activity used to call
     * `app.createApiService()` in its own `by lazy`, so each Activity
     * recreation (screen rotation, leaving and re-entering CardReportActivity,
     * etc.) built a brand-new OkHttpClient — each with its own connection
     * pool and dispatcher thread pool — throwing away connection keep-alive
     * and paying full setup cost again for no reason.
     *
     * The device token is still read fresh from SharedPreferences on every
     * request (see the interceptor below), so a token issued by a later
     * Setup run is picked up immediately without needing a new client. The
     * base URL is only re-read here at call time; if it changed (also only
     * happens via Setup) the cached client is replaced.
     */
    fun create(context: Context): ApiService {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences("esta_prefs", Context.MODE_PRIVATE)
        val baseUrl = (prefs.getString("server_url", "http://161.104.17.113") ?: "http://161.104.17.113")
            .trimEnd('/') + "/api/"

        cachedApiService?.let { existing -> if (cachedBaseUrl == baseUrl) return existing }

        synchronized(this) {
            cachedApiService?.let { existing -> if (cachedBaseUrl == baseUrl) return existing }

            // BODY-level logging dumps every request/response in full —
            // headers included — so the device's bearer token and worker
            // names/PII were being written to Logcat on every call, in
            // release builds too, not just while debugging. Restricting it
            // to debug builds keeps the same convenience for development
            // without leaking credentials from devices running the shipped
            // app.
            val logging = HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
            }

            val httpClient = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val token = prefs.getString("device_token", "") ?: ""
                    val req = chain.request().newBuilder()
                        .apply { if (token.isNotBlank()) addHeader("Authorization", "Bearer $token") }
                        .build()
                    chain.proceed(req)
                }
                .addInterceptor(logging)
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            val service = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(httpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)

            cachedApiService = service
            cachedBaseUrl = baseUrl
            return service
        }
    }
}
