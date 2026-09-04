package com.esta.attendance.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.esta.attendance.AttendanceApplication
import com.esta.attendance.DeviceHeartbeat
import com.esta.attendance.SyncManager
import com.esta.attendance.WorkerSyncManager
import java.util.concurrent.TimeUnit

/**
 * The in-app 30s sync loop (MainActivity.startPeriodicSync) only runs while
 * MainActivity is actually resumed — if the screen locks, the operator
 * switches app, or the device just sits idle for a while, that loop is
 * cancelled (see onPause) and queued attendance events stop syncing until
 * someone taps a card or reopens the app. This periodic WorkManager job is
 * the safety net: it keeps running in the background (survives the Activity
 * being gone, and even a process restart) so pending check-ins/check-outs
 * — the data that actually matters for payroll — don't sit stuck locally
 * for longer than necessary.
 *
 * 15 minutes is WorkManager's minimum periodic interval; the foreground loop
 * still covers the common case at a much tighter 30s cadence.
 */
class PendingEventsSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as AttendanceApplication
        val apiService = app.createApiService()
        val syncManager = SyncManager(app.repository, apiService)
        val workerSyncManager = WorkerSyncManager(app.workerDao, app.cardDao, apiService)

        val eventsResult = syncManager.syncPendingEvents()
        // Best-effort — also catch up the worker/card roster in the same
        // background window rather than waiting for the app to be reopened.
        workerSyncManager.syncFromServer()

        // Best-effort health check-in — this is often the only signal an
        // idle/backgrounded kiosk sends between foreground sessions.
        DeviceHeartbeat.send(app, apiService, app.repository.getPendingEventCount())

        return if (eventsResult.isSuccess) Result.success() else Result.retry()
    }

    companion object {
        private const val WORK_NAME = "pending_events_periodic_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<PendingEventsSyncWorker>(
                15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                // KEEP: re-running schedule() (e.g. every app cold start)
                // shouldn't reset an already-scheduled job's cycle.
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
