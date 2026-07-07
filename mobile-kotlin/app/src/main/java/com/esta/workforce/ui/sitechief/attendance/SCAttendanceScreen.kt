package com.esta.workforce.ui.sitechief.attendance

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.esta.workforce.data.model.ExtraHoursRequest
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class SCAttendanceViewModel(private val api: ApiService) : ViewModel() {
    private val _requests = MutableStateFlow<List<ExtraHoursRequest>>(emptyList())
    val requests: StateFlow<List<ExtraHoursRequest>> = _requests
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    fun load() {
        viewModelScope.launch {
            try { _requests.value = api.getSCRequests() } catch (_: Exception) {}
            finally { _loading.value = false; _refreshing.value = false }
        }
    }

    fun refresh() { _refreshing.value = true; load() }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { SCAttendanceViewModel(api) }
        }
    }
}

// ─── Worker row derived from requests ─────────────────────────────────────────

private data class WorkerRow(
    val workerEntityId: String,
    val name: String,
    val workerId: String,
    val foremanName: String,
    val totalExtraHrs: Double,
)

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SCAttendanceScreen(container: AppContainer) {
    val vm: SCAttendanceViewModel = viewModel(factory = SCAttendanceViewModel.factory(container.api))
    val requests by vm.requests.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    LaunchedEffect(Unit) { vm.load() }

    // Derive unique workers from all requests; accumulate approved hours
    val workerMap = linkedMapOf<String, WorkerRow>()
    for (req in requests) {
        for (item in req.items) {
            val existing = workerMap[item.workerEntityId]
            if (existing != null) {
                if (req.status == "approved") {
                    workerMap[item.workerEntityId] = existing.copy(totalExtraHrs = existing.totalExtraHrs + item.extraHours)
                }
            } else {
                workerMap[item.workerEntityId] = WorkerRow(
                    workerEntityId = item.workerEntityId,
                    name = item.workerName,
                    workerId = item.workerId,
                    foremanName = req.foremanName,
                    totalExtraHrs = if (req.status == "approved") item.extraHours else 0.0,
                )
            }
        }
    }
    val workerRows = workerMap.values.sortedBy { it.name }
    val totalExtraHrs = workerRows.sumOf { it.totalExtraHrs }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary)
        }
        return
    }

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = { vm.refresh() }, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Stats bar
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatItem(workerRows.size.toString(), "İşçi (mesai)", Primary)
                        VerticalDivider(modifier = Modifier.height(36.dp), color = colors.border)
                        StatItem("${totalExtraHrs.toInt()}h", "Tassykl. mesai", Success)
                        VerticalDivider(modifier = Modifier.height(36.dp), color = colors.border)
                        StatItem(requests.size.toString(), "Jemi sorag", colors.text)
                    }
                }
            }

            // Info box
            item {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = InfoLight,
                    border = BorderStroke(1.dp, Info.copy(alpha = 0.3f)),
                ) {
                    Text(
                        "Bu sahypa mesai soraglaryndan hasaplanan işçi sanawy görkezýär. Doly gatnaşyk görüntüsi admin panelinde elýeterli.",
                        modifier = Modifier.padding(12.dp),
                        fontSize = 12.sp,
                        color = Info,
                    )
                }
            }

            if (workerRows.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                        Text(strings.noData, color = colors.textMuted, fontSize = 14.sp)
                    }
                }
            } else {
                items(workerRows) { w ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = colors.card),
                        border = BorderStroke(1.dp, colors.border),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(w.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                Text(
                                    "${w.workerId} · ${w.foremanName}",
                                    fontSize = 11.sp,
                                    color = colors.textMuted,
                                )
                            }
                            if (w.totalExtraHrs > 0) {
                                Surface(shape = RoundedCornerShape(99.dp), color = SuccessLight) {
                                    Text(
                                        "+${w.totalExtraHrs.toInt()}h",
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Success,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatItem(value: String, label: String, valueColor: androidx.compose.ui.graphics.Color) {
    val colors = LocalAppColors.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = valueColor)
        Text(label, fontSize = 11.sp, color = colors.textMuted)
    }
}
