package com.esta.attendance.data.local.model

import androidx.room.Embedded
import androidx.room.Relation
import com.esta.attendance.data.local.entity.AttendanceEvent
import com.esta.attendance.data.local.entity.Worker

data class AttendanceEventWithWorker(
    @Embedded val event: AttendanceEvent,
    @Relation(
        parentColumn = "workerId",
        entityColumn = "id"
    )
    val worker: Worker?
)
