package com.esta.attendance

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import com.esta.attendance.data.local.entity.Worker
import com.esta.attendance.network.dto.CardUnbindRequest
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch

// Wraps a Worker for the search dropdown the same way MainActivity's binding
// dropdown does — toString() drives both the adapter's text matching and
// what's displayed, while onItemClickListener still resolves back to the
// exact tapped Worker (not just a name, which two workers can share).
private data class FixCardWorkerOption(val worker: Worker) {
    override fun toString(): String = worker.fullName
}

/**
 * Settings → "Fix Card Binding": operator self-service for a card that got
 * bound to the wrong worker. Replaces the old flow of reporting the mix-up
 * to the admin and waiting for them to fix it from the admin panel — the
 * operator now finds the worker who wrongly holds the card and clears it
 * (with a confirm dialog) right here, immediately and authoritatively on
 * the server (recorded in the tenant's card-assignment history, so the
 * admin panel still shows who did it and when).
 *
 * This screen only handles the "unbind" half. Once the card is cleared, the
 * operator hands the physical card back to the scanner — MainActivity's
 * existing "unknown card" flow takes over from there and lets them bind it
 * to the right worker.
 */
class FixCardActivity : BaseActivity() {

    companion object {
        /** Optional convenience prefill when launched right after a scan showed the wrong worker. */
        const val EXTRA_PREFILL_WORKER_NAME = "prefill_worker_name"
    }

    private val app by lazy { application as AttendanceApplication }
    private val apiService by lazy { app.createApiService() }

    private var allWorkers: List<Worker> = emptyList()
    private var selectedWorker: Worker? = null
    private var prefillApplied = false

    private lateinit var workerDropdown: AutoCompleteTextView
    private lateinit var layoutSelectedWorkerCard: View
    private lateinit var tvSelectedWorkerCardUid: TextView
    private lateinit var btnUnbindCard: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fix_card)

        val prefillName = intent.getStringExtra(EXTRA_PREFILL_WORKER_NAME)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbarFixCard)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        workerDropdown = findViewById(R.id.workerFixAutoComplete)
        layoutSelectedWorkerCard = findViewById(R.id.layoutSelectedWorkerCard)
        tvSelectedWorkerCardUid = findViewById(R.id.tvSelectedWorkerCardUid)
        btnUnbindCard = findViewById(R.id.btnUnbindCard)
        val btnCancel = findViewById<Button>(R.id.btnCancelFixCard)

        lifecycleScope.launch {
            app.workerDao.getAllWorkers().collect { workers ->
                allWorkers = workers
                val adapter = ArrayAdapter(
                    this@FixCardActivity,
                    android.R.layout.simple_dropdown_item_1line,
                    workers.map { FixCardWorkerOption(it) }
                )
                workerDropdown.setAdapter(adapter)

                // Pre-select the worker the operator just saw a bad scan
                // result for, once the roster has loaded. Only tried once —
                // if there's no exact match (e.g. it was cleared on another
                // device in the meantime) the operator just searches manually.
                if (!prefillApplied && !prefillName.isNullOrBlank()) {
                    prefillApplied = true
                    val match = workers.firstOrNull { it.fullName == prefillName }
                    if (match != null) {
                        selectedWorker = match
                        workerDropdown.setText(match.fullName, false)
                        refreshSelectedCardInfo()
                    }
                }
            }
        }

        workerDropdown.onItemClickListener =
            android.widget.AdapterView.OnItemClickListener { parent, _, position, _ ->
                selectedWorker = (parent.getItemAtPosition(position) as FixCardWorkerOption).worker
                refreshSelectedCardInfo()
            }

        btnUnbindCard.setOnClickListener {
            val worker = selectedWorker ?: return@setOnClickListener
            AlertDialog.Builder(this)
                .setTitle(getString(R.string.fix_card_confirm_title))
                .setMessage(getString(R.string.fix_card_confirm_message, worker.fullName))
                .setPositiveButton(getString(R.string.fix_card_confirm_yes)) { _, _ -> unbindCard(worker) }
                .setNegativeButton(getString(R.string.fix_card_confirm_no), null)
                .show()
        }

        btnCancel.setOnClickListener { finish() }
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun refreshSelectedCardInfo() {
        val worker = selectedWorker
        if (worker == null) {
            layoutSelectedWorkerCard.visibility = View.GONE
            btnUnbindCard.isEnabled = false
            return
        }
        lifecycleScope.launch {
            val activeCard = app.cardDao.getCardsByWorkerId(worker.id).firstOrNull { it.isActive }
            layoutSelectedWorkerCard.visibility = View.VISIBLE
            if (activeCard != null) {
                tvSelectedWorkerCardUid.text = activeCard.cardUid
                btnUnbindCard.isEnabled = true
            } else {
                tvSelectedWorkerCardUid.text = getString(R.string.fix_card_no_card)
                btnUnbindCard.isEnabled = false
            }
        }
    }

    private fun unbindCard(worker: Worker) {
        btnUnbindCard.isEnabled = false

        lifecycleScope.launch {
            try {
                // Applied on the server immediately — no admin approval step
                // — and recorded there in the card-assignment history.
                apiService.unbindWorkerCard(CardUnbindRequest(workerId = worker.employeeNumber))

                // Mirror the removal into this device's local cache too, so
                // the card doesn't keep matching this worker here while
                // waiting for the next periodic worker resync.
                app.cardDao.deleteCardsByWorkerId(worker.id)

                Toast.makeText(
                    this@FixCardActivity,
                    getString(R.string.fix_card_success, worker.fullName),
                    Toast.LENGTH_LONG
                ).show()
                finish()
            } catch (e: Exception) {
                Toast.makeText(this@FixCardActivity, getString(R.string.fix_card_error), Toast.LENGTH_LONG).show()
                btnUnbindCard.isEnabled = true
            }
        }
    }
}
