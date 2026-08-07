package com.workhour.worker.data.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object TokenHolder {
    @Volatile var token: String? = null
}

private object AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val t = TokenHolder.token
        val request = if (t != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $t")
                .build()
        } else chain.request()
        return chain.proceed(request)
    }
}

object ApiClient {
    private var retrofit: Retrofit? = null
    private var currentBase: String = ""

    fun get(serverUrl: String): ApiService {
        val base = serverUrl.trimEnd('/') + "/api/"
        if (retrofit == null || base != currentBase) {
            currentBase = base
            retrofit = Retrofit.Builder()
                .baseUrl(base)
                .client(buildOkHttp())
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!.create(ApiService::class.java)
    }

    private fun buildOkHttp() = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
        )
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
}
