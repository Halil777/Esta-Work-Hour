package com.esta.workforce.ui.sitechief.dashboard

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
import com.esta.workforce.data.model.ExtraHoursRequest
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.components.StatCard
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtDate(d: String) = try {
    SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(d)!!)
} catch (_: Exception) { d }

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class SCDashboardViewModel(private val api: ApiService) : ViewModel() {
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
            initializer { SCDashboardViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SCDashboardScreen(appVm: AppViewModel, container: AppContainer) {
    val vm: SCDashboardViewModel = viewModel(factory = SCDashboardViewModel.factory(container.api))
    val requests by vm.requests.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val user by appVm.user.collectAsState()
    val colors = LocalAppColors.current

    LaunchedEffect(Unit) { vm.load() }

    val todayStr = SimpleDateFormat("d MMMM", Locale("ru")).format(Date())
    val pending = requests.count { it.status == "pending" }
    val seen = requests.count { it.status == "seen" }
    val approved = requests.count { it.status == "approved" }
    val rejected = requests.count { it.status == "rejected" }

    val foremanMap = buildMap<String, Triple<String, Int, Int>> {
        requests.forEach { r ->
            val (_, total, pend) = getOrDefault(r.foremanWorkerEntityId, Triple(r.foremanName, 0, 0))
            put(r.foremanWorkerEntityId, Triple(r.foremanName, total + 1, if (r.status in listOf("pending", "seen")) pend + 1 else pend))
        }
    }.values.sortedByDescending { it.third }

    val recent = requests.sortedByDescending { it.sentAt }.take(5)

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
            // Header
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.card),
                border = BorderStroke(1.dp, colors.border),
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(todayStr, fontSize = 12.sp, color = colors.textMuted)
                    Text(user?.name ?: "", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
                    Text("Esta Construction", fontSize = 13.sp, color = colors.textSecondary)
                }
            }

            // Stats rows
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Jemi sorag", requests.size, modifier = Modifier.weight(1f))
                StatCard("Garaşylýar", pending, accent = Warning, modifier = Modifier.weight(1f))
                StatCard("Tassyklandy", approved, accent = Success, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Goruldi", seen, accent = Info, modifier = Modifier.weight(1f))
                StatCard("Ret edildi", rejected, accent = Danger, modifier = Modifier.weight(1f))
                StatCard("Foreman", foremanMap.size, modifier = Modifier.weight(1f))
            }

            // Foreman breakdown
            if (foremanMap.isNotEmpty()) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Foreman yagdayy", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        Spacer(Modifier.height(12.dp))
                        foremanMap.forEach { (name, total, pendCount) ->
                            HorizontalDivider(color = colors.border, thickness = 0.5.dp, modifier = Modifier.padding(vertical = 4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text, modifier = Modifier.weight(1f))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("$total sorag", fontSize = 12.sp, color = colors.textMuted)
                                    if (pendCount > 0) {
                                        Surface(shape = RoundedCornerShape(99.dp), color = WarningLight) {
                                            Text("$pendCount garasylyyar", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Warning, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Recent requests
            if (recent.isNotEmpty()) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Sonky soraglar", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        Spacer(Modifier.height(12.dp))
                        recent.forEach { r ->
                            val totalHrs = r.items.sumOf { it.extraHours }
                            val statusColor = when (r.status) {
                                "pending" -> Warning; "seen" -> Info; "approved" -> Success; else -> Danger
                            }
                            val statusLabel = when (r.status) {
                                "pending" -> "Garaşylýar"; "seen" -> "Goruldi"; "approved" -> "Tassyklandy"; else -> "Ret edildi"
                            }
                            HorizontalDivider(color = colors.border, thickness = 0.5.dp, modifier = Modifier.padding(vertical = 4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(r.foremanName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                    Text("${r.workDate} · ${r.items.size} işçi · ${totalHrs}h", fontSize = 11.sp, color = colors.textMuted)
                                }
                                Text(statusLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = statusColor)
                            }
                        }
                    }
                }
            }

            if (requests.isEmpty()) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = colors.card),
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                        Text("Heniz sorag yok", fontSize = 13.sp, color = colors.textMuted)
                    }
                }
            }
        }
    }
}
