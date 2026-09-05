package com.esta.attendance

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.esta.attendance.network.dto.BackendWorker
import com.esta.attendance.network.dto.ShiftChangeRequest
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

/**
 * Lets an operator move a worker between day/night shift directly from the
 * device. The change goes through the normal worker-update path on the
 * backend (WorkersCrudService.update), which already writes to the same
 * audit trail the admin panel shows on WorkerDetailPage — so the admin sees
 * who changed what and when without a separate notification system.
 */
class ShiftAssignmentActivity : BaseActivity() {

    private lateinit var etSearch: TextInputEditText
    private lateinit var recyclerView: RecyclerView
    private lateinit var progressLoading: ProgressBar
    private val adapter = ShiftWorkerAdapter { worker, newShift -> confirmShiftChange(worker, newShift) }

    private val apiService by lazy { (application as AttendanceApplication).createApiService() }
    private var allWorkers: List<BackendWorker> = emptyList()
    private var searchQuery: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_shift_assignment)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        etSearch = findViewById(R.id.etShiftSearch)
        recyclerView = findViewById(R.id.recyclerShiftWorkers)
        progressLoading = findViewById(R.id.progressShiftLoading)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchQuery = s?.toString()?.trim() ?: ""
                updateList()
            }
        })

        loadWorkers()
    }

    private fun loadWorkers() {
        progressLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val workers = apiService.getWorkers().filter { it.status == "Active" }
                allWorkers = workers
                updateList()
            } catch (e: Exception) {
                Toast.makeText(this@ShiftAssignmentActivity, R.string.workers_sync_error, Toast.LENGTH_LONG).show()
            } finally {
                progressLoading.visibility = View.GONE
            }
        }
    }

    private fun updateList() {
        val filtered = if (searchQuery.isEmpty()) {
            allWorkers
        } else {
            allWorkers.filter { it.name.contains(searchQuery, ignoreCase = true) }
        }
        adapter.submitList(filtered)
    }

    private fun confirmShiftChange(worker: BackendWorker, newShift: String) {
        val fromLabel = shiftLabel(worker.shift)
        val toLabel = shiftLabel(newShift)

        AlertDialog.Builder(this)
            .setTitle(R.string.shift_change_confirm_title)
            .setMessage(getString(R.string.shift_change_confirm_message, worker.name, fromLabel, toLabel))
            .setPositiveButton(R.string.confirm_binding) { dialog, _ ->
                dialog.dismiss()
                applyShiftChange(worker, newShift)
            }
            .setNegativeButton(R.string.biometric_cancel, null)
            .show()
    }

    private fun applyShiftChange(worker: BackendWorker, newShift: String) {
        lifecycleScope.launch {
            try {
                val updated = apiService.changeWorkerShift(worker.workerId, ShiftChangeRequest(newShift))
                allWorkers = allWorkers.map {
                    if (it.id == worker.id) it.copy(shift = updated.shift) else it
                }
                updateList()
                Toast.makeText(
                    this@ShiftAssignmentActivity,
                    getString(R.string.shift_change_success, worker.name, shiftLabel(newShift)),
                    Toast.LENGTH_SHORT
                ).show()
            } catch (e: Exception) {
                Toast.makeText(this@ShiftAssignmentActivity, R.string.shift_change_error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun shiftLabel(shift: String?): String = when (shift) {
        "day" -> getString(R.string.shift_day)
        "night" -> getString(R.string.shift_night)
        else -> getString(R.string.shift_none)
    }
}
