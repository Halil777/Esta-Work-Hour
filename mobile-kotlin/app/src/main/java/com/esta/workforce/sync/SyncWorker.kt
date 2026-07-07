package com.esta.workforce.sync

import android.content.Context
import androidx.work.*
import com.esta.workforce.WorkforceApp
import com.esta.workforce.data.model.CreateExtraRequest
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val container = (applicationContext as WorkforceApp).container
        val items = container.offlineQueue.getAll()
        if (items.isEmpty()) return@withContext Result.success()

        val gson = Gson()
        var anyFailed = false

        for (item in items) {
            try {
                when {
                    item.path.endsWith("extra-requests") && item.method == "POST" -> {
                        val body = gson.fromJson(item.body, CreateExtraRequest::class.java)
                        container.api.createExtraRequest(body)
                        container.offlineQueue.remove(item.id)
                    }
                    else -> container.offlineQueue.remove(item.id)
                }
            } catch (_: Exception) {
                anyFailed = true
            }
        }

        if (anyFailed) Result.retry() else Result.success()
    }

    companion object {
        private const val WORK_NAME = "offline_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
