package com.esta.attendance

import com.esta.attendance.data.local.dao.CardDao
import com.esta.attendance.data.local.dao.WorkerDao
import com.esta.attendance.data.local.entity.Card
import com.esta.attendance.data.local.entity.Worker
import com.esta.attendance.network.ApiService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class WorkerSyncManager(
    private val workerDao: WorkerDao,
    private val cardDao: CardDao,
    private val apiService: ApiService
) {
    // MainActivity now triggers a resync from several independent places
    // (cold start, onResume, the periodic tick, and an on-demand retry after
    // an unknown-card scan) — this serializes them so two overlapping runs
    // can never race on the same "does this employeeNumber already exist"
    // check-then-insert and create duplicate local rows for one worker.
    private val syncMutex = Mutex()

    /**
     * Full-replace sync: pulls all workers from backend (tenant-scoped via device token),
     * upserts them locally, and deletes any local workers no longer on the server.
     * Also syncs nfcCardUid -> local cards table.
     */
    suspend fun syncFromServer(): Result<Int> = syncMutex.withLock {
        try {
            val backendWorkers = apiService.getWorkers()
            val backendIds = backendWorkers.map { it.workerId }.toSet()

            // Delete local workers removed from backend
            val localIds = workerDao.getAllEmployeeNumbers()
            for (localId in localIds) {
                if (localId !in backendIds) {
                    workerDao.deleteByEmployeeNumber(localId)
                }
            }

            // Upsert backend workers + sync card UIDs
            for (bw in backendWorkers) {
                val existing = workerDao.getWorkerByEmployeeNumber(bw.workerId)
                val localWorkerId: Long
                if (existing != null) {
                    workerDao.updateByEmployeeNumber(
                        employeeNumber = bw.workerId,
                        fullName = bw.name,
                        position = bw.profession ?: "",
                        team = bw.brigadeName ?: "",
                        isActive = bw.status == "Active"
                    )
                    localWorkerId = existing.id
                } else {
                    localWorkerId = workerDao.insertWorker(
                        Worker(
                            fullName = bw.name,
                            employeeNumber = bw.workerId,
                            position = bw.profession ?: "",
                            team = bw.brigadeName ?: "",
                            isActive = bw.status == "Active"
                        )
                    )
                }

                // Sync card UID from backend into local cards table
                val cardUid = bw.nfcCardUid
                if (!cardUid.isNullOrBlank()) {
                    val existingCards = cardDao.getCardsByWorkerId(localWorkerId)
                    val alreadyLinked = existingCards.any { it.cardUid == cardUid }
                    if (!alreadyLinked) {
                        // Deactivate old cards for this worker before adding new one
                        existingCards.forEach { old ->
                            cardDao.insertCard(old.copy(isActive = false))
                        }
                        cardDao.insertCard(
                            Card(
                                workerId = localWorkerId,
                                cardUid = cardUid,
                                cardType = "NFC",
                                isActive = true,
                                registeredBy = "server"
                            )
                        )
                    }
                }
            }

            // The synced count shown to the operator ("N workers updated") must
            // match how the tenant-admin panel counts its workforce — which
            // always excludes Terminated workers by convention (see the
            // backend's workers-query.service.ts). backendWorkers.size would
            // include Terminated/Suspended/Transferred records too (the local
            // DB keeps them, flagged isActive=false, so card-report lookups
            // can still show who an old NFC card used to belong to) — but
            // reporting that raw total here made this count drift further and
            // further above the admin's number as more workers left over time.
            val activeCount = backendWorkers.count { it.status == "Active" }
            Result.success(activeCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
