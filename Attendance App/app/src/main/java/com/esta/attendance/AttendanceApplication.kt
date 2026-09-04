package com.esta.attendance

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import com.esta.attendance.data.local.AppDatabase
import com.esta.attendance.data.repository.AttendanceRepository
import com.esta.attendance.network.ApiService
import com.esta.attendance.network.RetrofitClient
import com.esta.attendance.sync.PendingEventsSyncWorker

class AttendanceApplication : Application() {

    /** True once the user has passed biometric/PIN auth in this process lifetime. */
    var isAuthenticated = false

    private val database by lazy { AppDatabase.getDatabase(this) }
    val workerDao by lazy { database.workerDao() }
    val cardDao by lazy { database.cardDao() }

    // RetrofitClient caches the built ApiService internally and only rebuilds it
    // when server_url changes; the auth interceptor re-reads device_token from
    // SharedPreferences on every request, so calling this repeatedly is cheap and
    // always reflects the latest Setup values.
    fun createApiService(): ApiService = RetrofitClient.create(this)

    val repository by lazy {
        AttendanceRepository(
            database.workerDao(),
            database.cardDao(),
            database.attendanceEventDao()
        )
    }

    override fun onCreate() {
        super.onCreate()
        // Apply user-selected theme before any activity starts
        val prefs = getSharedPreferences("esta_prefs", MODE_PRIVATE)
        val nightMode = when (prefs.getString("theme_mode", "dark")) {
            "light" -> AppCompatDelegate.MODE_NIGHT_NO
            "system" -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            else -> AppCompatDelegate.MODE_NIGHT_YES
        }
        AppCompatDelegate.setDefaultNightMode(nightMode)

        // Safety net for pending attendance events when MainActivity's 30s
        // foreground sync loop isn't running (screen locked, app backgrounded,
        // process killed and restarted by the OS).
        PendingEventsSyncWorker.schedule(this)
    }
}
