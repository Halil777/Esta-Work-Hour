package com.esta.workforce.ui.foreman.attendance

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.esta.workforce.AppContainer
import com.esta.workforce.data.model.MobileWorker
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtTime(ts: Long?): String {
    if (ts == null || ts == 0L) return "—"
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))
}

private fun fmtHours(ms: Long?): String? {
    if (ms == null || ms <= 0) return null
    val totalMin = (ms / 60000).toInt()
    val h = totalMin / 60
    val m = totalMin % 60
    return when {
        h == 0 -> "$m min"
        m == 0 -> "$h sag"
        else -> "$h sag $m min"
    }
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class AttendanceViewModel(private val api: ApiService) : ViewModel() {
    private val _workers = MutableStateFlow<List<MobileWorker>>(emptyList())
    val workers: StateFlow<List<MobileWorker>> = _workers
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing
    private val _stale = MutableStateFlow(false)
    val stale: StateFlow<Boolean> = _stale

    private var cached: List<MobileWorker> = emptyList()

    fun load() {
        viewModelScope.launch {
            try {
                val data = api.getMyWorkers()
                _workers.value = data
                cached = data
                _stale.value = false
            } catch (e: Exception) {
                if (cached.isNotEmpty()) {
                    _workers.value = cached
                    _stale.value = true
                }
            } finally {
                _loading.value = false
                _refreshing.value = false
            }
        }
    }

    fun refresh() { _refreshing.value = true; load() }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { AttendanceViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForemanAttendanceScreen(container: AppContainer) {
    val vm: AttendanceViewModel = viewModel(factory = AttendanceViewModel.factory(container.api))
    val workers by vm.workers.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val stale by vm.stale.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    var filter by remember { mutableStateOf("all") }

    LaunchedEffect(Unit) { vm.load() }

    val filtered = when (filter) {
        "present" -> workers.filter { it.lastCheckIn != null }
        "absent" -> workers.filter { it.lastCheckIn == null }
        else -> workers
    }
    val presentCount = workers.count { it.lastCheckIn != null }

    Column(
        modifier = Modifier.fillMaxSize(),
    ) {
        if (stale) {
            Surface(color = WarningLight) {
                Text(
                    "Offline — Sonky gocurilen maglumat",
                    fontSize = 12.sp,
                    color = Warning,
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
                )
            }
        }

        // Filter bar
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val filters = listOf("all" to strings.all, "present" to strings.workersPresent, "absent" to strings.workersAbsent)
            items(filters) { (key, label) ->
                val active = filter == key
                Surface(
                    onClick = { filter = key },
                    shape = RoundedCornerShape(99.dp),
                    color = if (active) Primary else colors.card,
                    border = BorderStroke(1.dp, if (active) Primary else colors.border),
                ) {
                    Text(
                        text = label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) Color.White else colors.textSecondary,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                    )
                }
            }
            item {
                Surface(
                    shape = RoundedCornerShape(99.dp),
                    color = colors.card2,
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Text(
                        text = "$presentCount/${workers.size}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Success,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                    )
                }
            }
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary)
            }
        } else {
            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { vm.refresh() },
                modifier = Modifier.fillMaxSize(),
            ) {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (filtered.isEmpty()) {
                        item {
                            Box(
                                Modifier.fillParentMaxWidth().padding(40.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(strings.noData, color = colors.textMuted, fontSize = 14.sp)
                            }
                        }
                    }
                    items(filtered) { w ->
                        val present = w.lastCheckIn != null
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = colors.card),
                            border = BorderStroke(1.dp, if (present) SuccessLight else colors.border),
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top,
                                ) {
                                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(w.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                        Text(
                                            "${w.workerId} · ${w.profession ?: "—"}",
                                            fontSize = 12.sp,
                                            color = colors.textMuted,
                                        )
                                        if (!w.brigadeName.isNullOrEmpty()) {
                                            Text(w.brigadeName, fontSize = 12.sp, color = colors.textSecondary)
                                        }
                                    }
                                    Surface(
                                        shape = RoundedCornerShape(99.dp),
                                        color = if (present) SuccessLight else DangerLight,
                                    ) {
                                        Text(
                                            text = if (present) "Isde" else "Yok",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (present) Success else Danger,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                        )
                                    }
                                }
                                if (present) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text("Giris:", fontSize = 11.sp, color = colors.textMuted)
                                        Text(fmtTime(w.lastCheckIn), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Success)
                                        if (w.lastCheckOut != null) {
                                            Text("  Cykys:", fontSize = 11.sp, color = colors.textMuted)
                                            Text(fmtTime(w.lastCheckOut), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Warning)
                                        }
                                        fmtHours(w.todayHoursMs)?.let { hrs ->
                                            Text("  Saat:", fontSize = 11.sp, color = colors.textMuted)
                                            Text(hrs, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Primary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
