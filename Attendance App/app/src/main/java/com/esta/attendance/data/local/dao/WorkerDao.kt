package com.esta.attendance.data.local.dao

import androidx.room.*
import com.esta.attendance.data.local.entity.Worker
import kotlinx.coroutines.flow.Flow

@Dao
interface WorkerDao {
    @Query("SELECT * FROM workers GROUP BY employeeNumber ORDER BY fullName ASC")
    fun getAllWorkers(): Flow<List<Worker>>

    @Query("SELECT DISTINCT employeeNumber FROM workers WHERE employeeNumber != ''")
    suspend fun getAllEmployeeNumbers(): List<String>

    @Query("DELETE FROM workers WHERE employeeNumber = :employeeNumber")
    suspend fun deleteByEmployeeNumber(employeeNumber: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWorker(worker: Worker): Long

    @Delete
    suspend fun deleteWorker(worker: Worker)

    @Query("SELECT * FROM workers WHERE id = :id")
    suspend fun getWorkerById(id: Long): Worker?

    @Query("SELECT * FROM workers WHERE employeeNumber = :employeeNumber LIMIT 1")
    suspend fun getWorkerByEmployeeNumber(employeeNumber: String): Worker?

    @Query("UPDATE workers SET fullName = :fullName, position = :position, team = :team, isActive = :isActive WHERE employeeNumber = :employeeNumber")
    suspend fun updateByEmployeeNumber(employeeNumber: String, fullName: String, position: String, team: String, isActive: Boolean)
}
