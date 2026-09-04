package com.esta.attendance.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "cards",
    foreignKeys = [
        ForeignKey(
            entity = Worker::class,
            parentColumns = ["id"],
            childColumns = ["workerId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["workerId"]), Index(value = ["cardUid"], unique = true)]
)
data class Card(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val workerId: Long,
    val cardUid: String,
    val cardType: String,
    val isActive: Boolean = true,
    val registeredAt: Long = System.currentTimeMillis(),
    val registeredBy: String? = null
)
