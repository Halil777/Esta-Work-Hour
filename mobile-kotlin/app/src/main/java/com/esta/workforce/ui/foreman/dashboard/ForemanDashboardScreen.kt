package com.esta.workforce.ui.foreman.dashboard

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
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.components.StatCard
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class ForemanDashboardViewModel(private val api: ApiService) : ViewModel() {
    private val _workers = MutableStateFlow<List<MobileWorker>>(emptyList())
    val workers: StateFlow<List<MobileWorker>> = _workers

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    private val _error = MutableStateFlow("")
    val error: StateFlow<String> = _error

    private val _stale = MutableStateFlow(false)
    val stale: StateFlow<Boolean> = _stale

    private var cached: List<MobileWorker> = emptyList()

    fun load(initial: List<MobileWorker> = emptyList()) {
        if (cached.isEmpty() && initial.isNotEmpty()) {
            cached = initial
            _workers.value = initial
        }
        viewModelScope.launch {
            try {
                val data = api.getMyWorkers()
                _workers.value = data
                cached = data
                _stale.value = false
                _error.value = ""
            } catch (e: Exception) {
                if (cached.isNotEmpty()) {
                    _workers.value = cached
                    _stale.value = true
                } else {
                    _error.value = e.message ?: "Yalnyslyk"
                }
            } finally {
                _loading.value = false
                _refreshing.value = false
            }
        }
    }

    fun refresh() {
        _refreshing.value = true
        load()
    }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { ForemanDashboardViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForemanDashboardScreen(appVm: AppViewModel, container: AppContainer) {
    val vm: ForemanDashboardViewModel = viewModel(factory = ForemanDashboardViewModel.factory(container.api))
    val cachedWorkers by appVm.cachedWorkers.collectAsState()
    val workers by vm.workers.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val error by vm.error.collectAsState()
    val stale by vm.stale.collectAsState()
    val user by appVm.user.collectAsState()
    val colors = LocalAppColors.current

    LaunchedEffect(Unit) { vm.load(cachedWorkers) }

    val presentCount = workers.count { it.lastCheckIn != null }
    val absentCount = workers.count { it.lastCheckIn == null }

    val todayStr = SimpleDateFormat("d MMMM", Locale("ru")).format(Date())

    val brigadeMap = buildMap<String, Triple<String, Int, Int>> {
        workers.forEach { w ->
            val key = w.brigadeName ?: "—"
            val (_, total, present) = getOrDefault(key, Triple(key, 0, 0))
            put(key, Triple(key, total + 1, if (w.lastCheckIn != null) present + 1 else present))
        }
    }
    val brigadeRows = brigadeMap.values.sortedByDescending { it.second }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { vm.refresh() },
        modifier = Modifier.fillMaxSize(),
    ) {
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Header card
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(todayStr, fontSize = 12.sp, color = colors.textMuted)
                        Text(
                            user?.name ?: "",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = colors.text,
                        )
                        Text("Esta Construction", fontSize = 13.sp, color = colors.textSecondary)
                    }
                }

                // Offline banner
                if (stale) {
                    Card(
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = WarningLight),
                        border = BorderStroke(1.dp, Warning),
                    ) {
                        Text(
                            "Offline — Sonky gocurilen maglumat gorkezi lar",
                            fontSize = 12.sp,
                            color = Warning,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }

                if (error.isNotEmpty()) {
                    Card(
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = DangerLight),
                    ) {
                        Text(error, fontSize = 13.sp, color = Danger, modifier = Modifier.padding(12.dp))
                    }
                }

                // Stats row
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard(label = "Jemi isci", value = workers.size, modifier = Modifier.weight(1f))
                    StatCard(label = "Iscde bar", value = presentCount, accent = Success, modifier = Modifier.weight(1f))
                    StatCard(label = "Yok", value = absentCount, accent = Danger, modifier = Modifier.weight(1f))
                }

                // Brigade breakdown
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Ekip yagdayy",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.text,
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        if (brigadeRows.isEmpty()) {
                            Text(
                                "Maglumat yok",
                                fontSize = 13.sp,
                                color = colors.textMuted,
                                modifier = Modifier.padding(vertical = 16.dp),
                            )
                        } else {
                            brigadeRows.forEach { (name, total, present) ->
                                val rate = if (total > 0) (present * 100f / total).toInt() else 0
                                val barColor = when {
                                    rate >= 90 -> Success
                                    rate >= 60 -> Warning
                                    else -> Danger
                                }
                                Column(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                    LinearProgressIndicator(
                                        progress = { rate / 100f },
                                        modifier = Modifier.fillMaxWidth().height(5.dp),
                                        color = barColor,
                                        trackColor = colors.card2,
                                    )
                                    Text(
                                        "$present/$total işçi · $rate%",
                                        fontSize = 11.sp,
                                        color = colors.textMuted,
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
