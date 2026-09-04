package com.esta.attendance

import android.content.Context
import android.os.BatteryManager
import android.util.Log
import com.esta.attendance.network.ApiService
import com.esta.attendance.network.dto.HeartbeatRequest

/**
 * Sends a periodic health check-in (battery %, installed APK version, count
 * of attendance events still waiting to sync) so the admin panel can flag a
 * kiosk that's running low on power, stuck on an old build, or silently
 * piling up unsynced scans — without anyone walking over to the device.
 *
 * Best-effort only: a failed heartbeat (offline, backend hiccup) is logged
 * and swallowed, never allowed to interrupt the scan flow or the sync loop
 * that calls it.
 */
object DeviceHeartbeat {

    private fun batteryLevel(context: Context): Int? {
        return try {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val level = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            if (level in 0..100) level else null
        } catch (e: Exception) {
            null
        }
    }

    private fun appVersion(context: Context): String? {
        return try {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        } catch (e: Exception) {
            null
        }
    }

    suspend fun send(context: Context, apiService: ApiService, pendingEventCount: Int) {
        try {
            apiService.sendHeartbeat(
                HeartbeatRequest(
                    batteryLevel = batteryLevel(context),
                    appVersion = appVersion(context),
                    pendingEventCount = pendingEventCount,
                )
            )
        } catch (e: Exception) {
            Log.w("DeviceHeartbeat", "heartbeat failed: ${e.javaClass.simpleName}: ${e.message}")
        }
    }
}
