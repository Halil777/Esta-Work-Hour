package com.esta.workforce.ui.sitechief.reports

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.esta.workforce.data.model.ExtraHoursRequest
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class ReportsViewModel(private val api: ApiService) : ViewModel() {
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
            initializer { ReportsViewModel(api) }
        }
    }
}

// ─── Foreman breakdown row ─────────────────────────────────────────────────────

private data class ForemanRow(
    val name: String,
    val total: Int,
    val approved: Int,
    val rejected: Int,
    val totalHrs: Double,
)

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(container: AppContainer) {
    val vm: ReportsViewModel = viewModel(factory = ReportsViewModel.factory(container.api))
    val requests by vm.requests.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val colors = LocalAppColors.current

    LaunchedEffect(Unit) { vm.load() }

    val pending = requests.count { it.status == "pending" }
    val seen = requests.count { it.status == "seen" }
    val approved = requests.count { it.status == "approved" }
    val rejected = requests.count { it.status == "rejected" }

    val approvedRequests = requests.filter { it.status == "approved" }
    val totalApprovedHrs = approvedRequests.sumOf { r -> r.items.sumOf { it.extraHours } }
    val totalWorkers = approvedRequests.flatMap { r -> r.items.map { it.workerEntityId } }.toSet().size

    // Foreman breakdown
    val foremanMap = linkedMapOf<String, ForemanRow>()
    for (r in requests) {
        val key = r.foremanWorkerEntityId
        val f = foremanMap[key] ?: ForemanRow(name = r.foremanName, total = 0, approved = 0, rejected = 0, totalHrs = 0.0)
        foremanMap[key] = f.copy(
            total = f.total + 1,
            approved = if (r.status == "approved") f.approved + 1 else f.approved,
            rejected = if (r.status == "rejected") f.rejected + 1 else f.rejected,
            totalHrs = if (r.status == "approved") f.totalHrs + r.items.sumOf { it.extraHours } else f.totalHrs,
        )
    }
    val foremanRows = foremanMap.values.sortedByDescending { it.totalHrs }

    val todayStr = SimpleDateFormat("d MMMM yyyy", Locale("ru")).format(Date())

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary)
        }
        return
    }

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = { vm.refresh() }, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Mesai Hasabaty", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            Text(todayStr, fontSize = 13.sp, color = colors.textMuted)

            // Summary grid — 2 per row
            val summaryItems = listOf(
                Triple("Jemi sorag", requests.size.toString(), colors.text),
                Triple("Garaşylýar", (pending + seen).toString(), Warning),
                Triple("Tassyklandy", approved.toString(), Success),
                Triple("Ret edildi", rejected.toString(), Danger),
                Triple("Tassykl. sagat", "${totalApprovedHrs.toInt()}h", Primary),
                Triple("İşçi (mesai)", totalWorkers.toString(), Info),
            )

            for (i in summaryItems.indices step 2) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SummaryCard(summaryItems[i].first, summaryItems[i].second, summaryItems[i].third, Modifier.weight(1f))
                    if (i + 1 < summaryItems.size) {
                        SummaryCard(summaryItems[i + 1].first, summaryItems[i + 1].second, summaryItems[i + 1].third, Modifier.weight(1f))
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }

            // Foreman breakdown
            if (foremanRows.isNotEmpty()) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Foreman ýüzünden", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        Spacer(Modifier.height(12.dp))
                        foremanRows.forEachIndexed { idx, f ->
                            val approvePct = if (f.total > 0) (f.approved * 100 / f.total) else 0
                            val barColor = when {
                                approvePct >= 70 -> Success
                                approvePct >= 40 -> Warning
                                else -> Danger
                            }
                            if (idx > 0) HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(f.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                    // Progress bar
                                    BoxWithConstraints(
                                        modifier = Modifier.fillMaxWidth().height(5.dp),
                                    ) {
                                        val trackWidth = maxWidth
                                        Box(
                                            modifier = Modifier.fillMaxWidth().height(5.dp),
                                        ) {
                                            Surface(
                                                modifier = Modifier.fillMaxSize(),
                                                shape = RoundedCornerShape(99.dp),
                                                color = colors.card2,
                                            ) {}
                                            Surface(
                                                modifier = Modifier.fillMaxHeight().width(trackWidth * approvePct / 100),
                                                shape = RoundedCornerShape(99.dp),
                                                color = barColor,
                                            ) {}
                                        }
                                    }
                                    Text(
                                        "${f.total} sorag · ${f.approved} tassl. · ${f.totalHrs.toInt()}h",
                                        fontSize = 11.sp,
                                        color = colors.textMuted,
                                    )
                                }
                                Text(
                                    "$approvePct%",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = colors.textSecondary,
                                )
                            }
                        }
                    }
                }
            }

            if (requests.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                    Text("Heniz sorag ýok", color = colors.textMuted, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, valueColor: Color, modifier: Modifier = Modifier) {
    val colors = LocalAppColors.current
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = colors.card),
        border = BorderStroke(1.dp, colors.border),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(value, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = valueColor)
            Text(label, fontSize = 11.sp, color = colors.textMuted)
        }
    }
}
