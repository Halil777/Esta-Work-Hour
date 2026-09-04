package com.esta.attendance.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.esta.attendance.data.local.dao.AttendanceEventDao
import com.esta.attendance.data.local.dao.CardDao
import com.esta.attendance.data.local.dao.WorkerDao
import com.esta.attendance.data.local.entity.AttendanceEvent
import com.esta.attendance.data.local.entity.Card
import com.esta.attendance.data.local.entity.Worker

@Database(
    entities = [Worker::class, Card::class, AttendanceEvent::class],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun workerDao(): WorkerDao
    abstract fun cardDao(): CardDao
    abstract fun attendanceEventDao(): AttendanceEventDao

    companion object {
        // Adds the employeeNumber unique index from Worker.kt without
        // touching attendance_events — anything still PENDING sync is
        // completely untouched by this migration.
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Defensive de-dup first: creating a UNIQUE index fails
                // outright if any existing install already has duplicate
                // employeeNumber rows. Keeps the highest id (most recently
                // inserted/updated) per employeeNumber; a no-op if there
                // were never any duplicates, which is the expected case.
                db.execSQL(
                    """
                    DELETE FROM workers WHERE id NOT IN (
                        SELECT MAX(id) FROM workers GROUP BY employeeNumber
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS `index_workers_employeeNumber` ON `workers` (`employeeNumber`)"
                )
            }
        }

        // Adds the GPS location columns captured at scan time — existing
        // PENDING rows just get null lat/lng (synced without a location,
        // same as before this feature existed).
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE attendance_events ADD COLUMN latitude REAL")
                db.execSQL("ALTER TABLE attendance_events ADD COLUMN longitude REAL")
            }
        }

        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "attendance_database"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
