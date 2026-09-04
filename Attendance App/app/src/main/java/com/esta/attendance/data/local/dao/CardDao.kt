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
}
