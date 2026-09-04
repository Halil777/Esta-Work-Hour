package com.esta.attendance

import android.os.Bundle
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.esta.attendance.network.dto.ShiftAlertData
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Shows workers who have not scanned in yet for their shift, past the grace
 * period — sourced from the server's tenant-wide shift-alerts computation
 * (see ApiService.getShiftAlerts / backend AttendanceAnomaliesService), so
 * every device shows the exact same list: a worker who scanned on another
 * device drops off here as soon as this screen refreshes, with no per-device
 * "scanned" state to keep in sync.
 */
class NotScannedActivity : BaseActivity() {

    companion object {
        private const val POLL_INTERVAL_MS = 20_000L
    }

    private lateinit var tvDayCount: TextView
    private lateinit var tvDayMessage: TextView
    private lateinit var tvDayEmpty: TextView
    private lateinit var recyclerDay: RecyclerView
    private val dayAdapter = NotScannedAdapter()

    private lateinit var tvNightCount: TextView
    private lateinit var tvNightMessage: TextView
    private lateinit var tvNightEmpty: TextView
    private lateinit var recyclerNight: RecyclerView
    private val nightAdapter = NotScannedAdapter()

    private val apiService by lazy { (application as AttendanceApplication).createApiService() }
    private var pollJob: kotlinx.coroutines.Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_not_scanned)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        tvDayCount = findViewById(R.id.tvDayCount)
        tvDayMessage = findViewById(R.id.tvDayMessage)
        tvDayEmpty = findViewById(R.id.tvDayEmpty)
        recyclerDay = findViewById(R.id.recyclerDayNotScanned)
        recyclerDay.layoutManager = LinearLayoutManager(this)
        recyclerDay.adapter = dayAdapter

        tvNightCount = findViewById(R.id.tvNightCount)
        tvNightMessage = findViewById(R.id.tvNightMessage)
        tvNightEmpty = findViewById(R.id.tvNightEmpty)
        recyclerNight = findViewById(R.id.recyclerNightNotScanned)
        recyclerNight.layoutManager = LinearLayoutManager(this)
        recyclerNight.adapter = nightAdapter
    }

    override fun onResume() {
        super.onResume()
        pollJob = lifecycleScope.launch {
            while (true) {
                refresh()
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        pollJob?.cancel()
        pollJob = null
    }

    private suspend fun refresh() {
        try {
            val response = apiService.getShiftAlerts()
            bindSection(response.day, tvDayCount, tvDayMessage, tvDayEmpty, dayAdapter, R.string.not_scanned_day_shift)
            bindSection(response.night, tvNightCount, tvNightMessage, tvNightEmpty, nightAdapter, R.string.not_scanned_night_shift)
        } catch (e: Exception) {
            android.util.Log.w("NotScannedActivity", "Could not refresh shift alerts: ${e.message}")
        }
    }

    private fun bindSection(
        data: ShiftAlertData,
        tvCount: TextView,
        tvMessage: TextView,
        tvEmpty: TextView,
        adapter: NotScannedAdapter,
        shiftLabelRes: Int
    ) {
        adapter.submitList(data.workers)
        tvCount.text = getString(R.string.not_scanned_count, data.workers.size)

        if (!data.graceExpired) {
            tvMessage.visibility = android.view.View.GONE
            tvEmpty.visibility = android.view.View.VISIBLE
            tvEmpty.text = getString(R.string.not_scanned_grace_pending)
        } else if (data.workers.isEmpty()) {
            tvMessage.visibility = android.view.View.GONE
            tvEmpty.visibility = android.view.View.VISIBLE
            tvEmpty.text = getString(R.string.not_scanned_none)
        } else {
            tvEmpty.visibility = android.view.View.GONE
            tvMessage.visibility = android.view.View.VISIBLE
            tvMessage.text = getString(R.string.not_scanned_alert_message, getString(shiftLabelRes))
        }
    }
}
