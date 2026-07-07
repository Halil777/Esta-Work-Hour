package com.esta.workforce

import android.app.Application
import com.esta.workforce.data.local.OfflineQueue
import com.esta.workforce.data.local.PrefsDataStore
import com.esta.workforce.data.network.ApiClient
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.sync.SyncWorker

class AppContainer(context: Application) {
    val prefs = PrefsDataStore(context)
    val api: ApiService = ApiClient.instance
    val offlineQueue = OfflineQueue(context)
}

class WorkforceApp : Application() {
    val container by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        SyncWorker.schedule(this)
    }
}
