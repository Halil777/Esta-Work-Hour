package com.esta.attendance

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.esta.attendance.data.local.entity.Worker
import com.esta.attendance.network.dto.CardReportRequest
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class CardReportActivity : BaseActivity() {

    companion object {
        const val EXTRA_CARD_UID = "card_uid"
        const val EXTRA_CURRENT_WORKER_NAME = "current_worker_name"
    }

    private val app by lazy { application as AttendanceApplication }
    private val apiService by lazy { app.createApiService() }

    private var allWorkers: List<Worker> = emptyList()
    private var selectedWorker: Worker? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_card_report)

        val cardUid = intent.getStringExtra(EXTRA_CARD_UID) ?: ""
        val currentWorkerName = intent.getStringExtra(EXTRA_CURRENT_WORKER_NAME)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbarReport)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        findViewById<TextView>(R.id.tvReportCardUid).text = cardUid

        val layoutCurrentWorker = findViewById<View>(R.id.layoutCurrentWorker)
        if (!currentWorkerName.isNullOrBlank()) {
            layoutCurrentWorker.visibility = View.VISIBLE
            findViewById<TextView>(R.id.tvReportCurrentWorker).text = currentWorkerName
        } else {
            layoutCurrentWorker.visibility = View.GONE
        }

        val workerDropdown = findViewById<AutoCompleteTextView>(R.id.workerSuggestAutoComplete)
        lifecycleScope.launch {
            app.workerDao.getAllWorkers().collect { workers ->
                allWorkers = workers
                val adapter = ArrayAdapter(
                    this@CardReportActivity,
                    android.R.layout.simple_dropdown_item_1line,
                    workers.map { it.fullName }
                )
                workerDropdown.setAdapter(adapter)
            }
        }

        workerDropdown.setOnItemClickListener { _, _, position, _ ->
            selectedWorker = allWorkers.getOrNull(position)
        }

        val etNote = findViewById<TextInputEditText>(R.id.etReportNote)
        val btnSend = findViewById<Button>(R.id.btnSendReport)
        val btnCancel = findViewById<Button>(R.id.btnCancelReport)

        btnSend.setOnClickListener {
            val note = etNote.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            sendReport(cardUid, currentWorkerName, note)
        }
        btnCancel.setOnClickListener { finish() }
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun sendReport(cardUid: String, currentWorkerName: String?, note: String?) {
        val btnSend = findViewById<Button>(R.id.btnSendReport)
        btnSend.isEnabled = false

        lifecycleScope.launch {
            try {
                apiService.submitCardReport(
                    CardReportRequest(
                        cardUid = cardUid,
                        currentWorkerName = currentWorkerName,
                        suggestedWorkerId = selectedWorker?.employeeNumber,
                        suggestedWorkerName = selectedWorker?.fullName,
                        note = note
                    )
                )
                Toast.makeText(
                    this@CardReportActivity,
                    getString(R.string.card_report_sent),
                    Toast.LENGTH_LONG
                ).show()
                finish()
            } catch (e: Exception) {
                Toast.makeText(
                    this@CardReportActivity,
                    getString(R.string.card_report_error),
                    Toast.LENGTH_LONG
                ).show()
                btnSend.isEnabled = true
            }
        }
    }
}
