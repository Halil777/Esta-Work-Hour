package com.esta.attendance

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.esta.attendance.data.local.model.AttendanceEventWithWorker
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class AttendanceHistoryActivity : BaseActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var tvHistoryCount: TextView
    private lateinit var tvPendingCount: TextView
    private lateinit var etSearch: TextInputEditText
    private val adapter = AttendanceEventAdapter()
    private val repository by lazy { (application as AttendanceApplication).repository }

    private var allEvents: List<AttendanceEventWithWorker> = emptyList()
    private var searchQuery: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_attendance_history)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        tvHistoryCount = findViewById(R.id.tvHistoryCount)
        tvPendingCount = findViewById(R.id.tvPendingCount)
        etSearch = findViewById(R.id.etHistorySearch)

        recyclerView = findViewById(R.id.recyclerViewEvents)
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

        lifecycleScope.launch {
            repository.allEventsWithWorker.collect { events ->
                allEvents = events
                updateList()
            }
        }
    }

    private fun updateList() {
        val filtered = if (searchQuery.isEmpty()) {
            allEvents
        } else {
            allEvents.filter { item ->
                item.worker?.fullName?.contains(searchQuery, ignoreCase = true) == true
            }
        }
        adapter.submitList(filtered)

        val total = allEvents.size
        val pending = allEvents.count { it.event.syncStatus == "PENDING" }
        tvHistoryCount.text = getString(R.string.history_count, total)
        tvPendingCount.text = "● ${getString(R.string.history_pending, pending)}"
    }
}
