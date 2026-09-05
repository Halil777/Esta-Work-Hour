package com.esta.attendance.data.local.dao

import androidx.room.*
import com.esta.attendance.data.local.entity.Card

@Dao
interface CardDao {
    @Query("SELECT * FROM cards WHERE cardUid = :cardUid AND isActive = 1 LIMIT 1")
    suspend fun getActiveCardByUid(cardUid: String): Card?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCard(card: Card): Long

    @Query("SELECT * FROM cards WHERE workerId = :workerId")
    suspend fun getCardsByWorkerId(workerId: Long): List<Card>

    /**
     * Local counterpart of the server's card-unbind: removes this worker's
     * card row(s) from the on-device cache after a successful
     * unbindWorkerCard() call, so the (now cleared) card doesn't keep
     * matching this worker on this device while waiting for the next
     * periodic worker resync to catch up.
     */
    @Query("DELETE FROM cards WHERE workerId = :workerId")
    suspend fun deleteCardsByWorkerId(workerId: Long)
}
