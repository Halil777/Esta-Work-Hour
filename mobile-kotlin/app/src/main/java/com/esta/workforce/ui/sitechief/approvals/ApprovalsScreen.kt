package com.esta.workforce.ui.sitechief.approvals

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.esta.workforce.AppContainer
import com.esta.workforce.data.model.ExtraHoursRequest
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.components.StatusPill
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtDate(d: String) = try {
    SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(d)!!)
} catch (_: Exception) { d }

private data class StatusMeta(val label: String, val color: androidx.compose.ui.graphics.Color, val bg: androidx.compose.ui.graphics.Color)

private fun statusMeta(status: String, strings: AppStrings) = when (status) {
    "pending" -> StatusMeta(strings.statusPending, Warning, WarningLight)
    "seen" -> StatusMeta(strings.statusSeen, Info, InfoLight)
    "approved" -> StatusMeta(strings.statusApproved, Success, SuccessLight)
    else -> StatusMeta(strings.statusRejected, Danger, DangerLight)
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class ApprovalsViewModel(private val api: ApiService) : ViewModel() {
    private val _requests = MutableStateFlow<List<ExtraHoursRequest>>(emptyList())
    val requests: StateFlow<List<ExtraHoursRequest>> = _requests
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing
    private val _saving = MutableStateFlow(false)
    val saving: StateFlow<Boolean> = _saving

    fun load() {
        viewModelScope.launch {
            try { _requests.value = api.getSCRequests() } catch (_: Exception) {}
            finally { _loading.value = false; _refreshing.value = false }
        }
    }

    fun refresh() { _refreshing.value = true; load() }

    fun markSeen(id: String, onDone: (ExtraHoursRequest) -> Unit) {
        viewModelScope.launch {
            try {
                val updated = api.markSeen(id)
                _requests.value = _requests.value.map { if (it.id == updated.id) updated else it }
                onDone(updated)
            } catch (_: Exception) {}
        }
    }

    fun takeAction(id: String, action: String, onDone: () -> Unit, onError: (String) -> Unit) {
        _saving.value = true
        viewModelScope.launch {
            try {
                val updated = api.takeAction(id, com.esta.workforce.data.model.ActionRequest(action))
                _requests.value = _requests.value.map { if (it.id == updated.id) updated else it }
                onDone()
            } catch (e: Exception) {
                onError(e.message ?: "Yalnyslyk")
            } finally {
                _saving.value = false
            }
        }
    }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { ApprovalsViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApprovalsScreen(container: AppContainer) {
    val vm: ApprovalsViewModel = viewModel(factory = ApprovalsViewModel.factory(container.api))
    val requests by vm.requests.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    var filter by remember { mutableStateOf("pending") }
    var selected by remember { mutableStateOf<ExtraHoursRequest?>(null) }
    val snackHost = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.load() }

    val filters = listOf("all", "pending", "seen", "approved", "rejected")
    val filtered = if (filter == "all") requests else requests.filter { it.status == filter }
    val pendingCount = requests.count { it.status == "pending" }

    Scaffold(snackbarHost = { SnackbarHost(snackHost) }, containerColor = colors.bg, contentWindowInsets = WindowInsets(0)) { pad ->
        Column(modifier = Modifier.fillMaxSize().padding(pad)) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(filters) { f ->
                    val meta = if (f != "all") statusMeta(f, strings) else null
                    val label = meta?.label ?: strings.all
                    val active = filter == f
                    Surface(
                        onClick = { filter = f },
                        shape = RoundedCornerShape(99.dp),
                        color = if (active) Primary else colors.card,
                        border = BorderStroke(1.dp, if (active) Primary else colors.border),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (active) Color.White else colors.textSecondary)
                            if (f == "pending" && pendingCount > 0) {
                                Surface(shape = RoundedCornerShape(99.dp), color = Danger, modifier = Modifier.size(18.dp)) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(pendingCount.toString(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Primary) }
            } else {
                PullToRefreshBox(isRefreshing = refreshing, onRefresh = { vm.refresh() }, modifier = Modifier.fillMaxSize()) {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (filtered.isEmpty()) {
                            item {
                                Box(Modifier.fillParentMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                                    Text(strings.noData, color = colors.textMuted, fontSize = 14.sp)
                                }
                            }
                        }
                        items(filtered) { req ->
                            val meta = statusMeta(req.status, strings)
                            val totalHrs = req.items.sumOf { it.extraHours }
                            Card(
                                onClick = {
                                    if (req.status == "pending") {
                                        vm.markSeen(req.id) { updated -> selected = updated }
                                    } else {
                                        selected = req
                                    }
                                },
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = colors.card),
                                border = BorderStroke(1.dp, if (req.status == "pending") Warning.copy(0.5f) else colors.border),
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                                        Column {
                                            Text(req.workDate, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                            Text("Foreman: ${req.foremanName}", fontSize = 12.sp, color = colors.textSecondary)
                                        }
                                        StatusPill(meta.label, meta.color, meta.bg)
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Text("${req.items.size} işçi", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                                        Text("${totalHrs}h jemi", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Primary)
                                    }
                                    if (!req.note.isNullOrEmpty()) Text(req.note, fontSize = 12.sp, color = colors.textMuted)
                                    Text(fmtDate(req.sentAt), fontSize = 11.sp, color = colors.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Detail modal
    selected?.let { req ->
        val saving by vm.saving.collectAsState()
        Dialog(onDismissRequest = { selected = null }) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = colors.card),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Mesai soragy", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        TextButton(onClick = { selected = null }) { Text("✕", color = colors.textMuted, fontSize = 18.sp) }
                    }

                    Column(
                        modifier = Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf(
                            "Foreman" to req.foremanName,
                            "Is senesi" to req.workDate,
                        ).forEach { (label, value) ->
                            HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textMuted)
                                Text(value, fontSize = 13.sp, color = colors.text)
                            }
                        }
                        if (!req.note.isNullOrEmpty()) {
                            HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Sebap", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textMuted)
                                Text(req.note, fontSize = 13.sp, color = colors.text, modifier = Modifier.weight(1f, fill = false).padding(start = 16.dp))
                            }
                        }
                        HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Yagday", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textMuted)
                            val m = statusMeta(req.status, strings)
                            StatusPill(m.label, m.color, m.bg)
                        }

                        Spacer(Modifier.height(4.dp))
                        Text("İşçiler (${req.items.size})", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                        req.items.forEach { item ->
                            Card(
                                shape = RoundedCornerShape(10.dp),
                                colors = CardDefaults.cardColors(containerColor = colors.card2),
                                border = BorderStroke(1.dp, colors.border),
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(item.workerName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                        Text(item.workerId, fontSize = 11.sp, color = colors.textMuted)
                                        if (!item.description.isNullOrEmpty()) {
                                            Text("\"${item.description}\"", fontSize = 12.sp, color = colors.textSecondary, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                                        }
                                    }
                                    Surface(shape = RoundedCornerShape(99.dp), color = PrimaryLight) {
                                        Text("${item.extraHours}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Primary, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
                                    }
                                }
                            }
                        }

                        // Action buttons (pending or seen)
                        if (req.status == "pending" || req.status == "seen") {
                            Spacer(Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedButton(
                                    onClick = {
                                        vm.takeAction(req.id, "approved",
                                            onDone = { selected = null },
                                            onError = {},
                                        )
                                    },
                                    modifier = Modifier.weight(1f),
                                    enabled = !saving,
                                    border = BorderStroke(1.dp, Success),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(containerColor = SuccessLight),
                                ) {
                                    if (saving) CircularProgressIndicator(color = Success, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    else Text("✓ Tassykla", color = Success, fontWeight = FontWeight.Bold)
                                }
                                OutlinedButton(
                                    onClick = {
                                        vm.takeAction(req.id, "rejected",
                                            onDone = { selected = null },
                                            onError = {},
                                        )
                                    },
                                    modifier = Modifier.weight(1f),
                                    enabled = !saving,
                                    border = BorderStroke(1.dp, Danger),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(containerColor = DangerLight),
                                ) {
                                    if (saving) CircularProgressIndicator(color = Danger, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    else Text("✕ Ret et", color = Danger, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
