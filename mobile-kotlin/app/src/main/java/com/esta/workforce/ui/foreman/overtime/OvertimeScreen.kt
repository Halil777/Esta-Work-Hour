package com.esta.workforce.ui.foreman.overtime

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.esta.workforce.AppContainer
import com.esta.workforce.data.local.OfflineQueue
import com.esta.workforce.data.model.*
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.sync.SyncWorker
import java.util.Calendar
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.components.StatusPill
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtDate(d: String): String = try {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val out = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
    out.format(sdf.parse(d)!!)
} catch (_: Exception) { d }

private data class StatusMeta(val label: String, val color: Color, val bg: Color)

private fun statusMeta(status: String, strings: AppStrings): StatusMeta = when (status) {
    "pending" -> StatusMeta(strings.statusPending, Warning, WarningLight)
    "seen"    -> StatusMeta(strings.statusSeen, Info, InfoLight)
    "approved"-> StatusMeta(strings.statusApproved, Success, SuccessLight)
    else      -> StatusMeta(strings.statusRejected, Danger, DangerLight)
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class OvertimeViewModel(
    application: Application,
    private val api: ApiService,
    private val offlineQueue: OfflineQueue,
) : AndroidViewModel(application) {

    private val _requests = MutableStateFlow<List<ExtraHoursRequest>>(emptyList())
    val requests: StateFlow<List<ExtraHoursRequest>> = _requests
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing
    private val _error = MutableStateFlow("")
    val error: StateFlow<String> = _error
    private val _statusMsg = MutableStateFlow("")
    val statusMsg: StateFlow<String> = _statusMsg

    val siteChiefs = MutableStateFlow<List<SiteChiefOption>>(emptyList())
    val myWorkers = MutableStateFlow<List<MobileWorker>>(emptyList())
    // Map shiftType -> ShiftSetting (day/night times for display)
    val shiftSettingsMap = MutableStateFlow<Map<String, ShiftSetting>>(emptyMap())

    private fun isConnected(): Boolean {
        val cm = getApplication<Application>().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val cap = cm.getNetworkCapabilities(network) ?: return false
        return cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun load() {
        viewModelScope.launch {
            try {
                _requests.value = api.getForemanRequests()
                _error.value = ""
            } catch (e: Exception) {
                _error.value = e.message ?: "Yalnyslyk"
            } finally {
                _loading.value = false
                _refreshing.value = false
            }
        }
    }

    fun refresh() { _refreshing.value = true; load() }

    fun loadCreateData() {
        viewModelScope.launch {
            try { siteChiefs.value = api.getSiteChiefs() } catch (_: Exception) {}
            try { myWorkers.value = api.getMyWorkers() } catch (_: Exception) {}
            try {
                val list = api.getShiftSettings()
                shiftSettingsMap.value = list.associateBy { it.shiftType }
            } catch (_: Exception) {}
        }
    }

    fun createRequest(
        siteChiefId: String,
        workDate: String,
        note: String?,
        items: List<CreateExtraRequestItem>,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            val body = CreateExtraRequest(siteChiefId, workDate, note?.ifBlank { null }, items)
            if (!isConnected()) {
                offlineQueue.add("/mobile/foreman/extra-requests", "POST", body, "Mesai soragy")
                SyncWorker.schedule(getApplication())
                _statusMsg.value = "Mesai soragy ýatda saklandy. Internet baglanyşanda iberiler."
                onSuccess()
                return@launch
            }
            try {
                api.createExtraRequest(body)
                _statusMsg.value = ""
                load()
                onSuccess()
            } catch (e: Exception) {
                val isNetworkError = e is java.net.UnknownHostException ||
                    e is java.net.SocketTimeoutException ||
                    e is java.net.ConnectException
                if (isNetworkError) {
                    offlineQueue.add("/mobile/foreman/extra-requests", "POST", body, "Mesai soragy")
                    SyncWorker.schedule(getApplication())
                    _statusMsg.value = "Mesai soragy ýatda saklandy. Internet baglanyşanda iberiler."
                    onSuccess()
                } else {
                    onError(e.message ?: "Yalnyslyk")
                }
            }
        }
    }

    companion object {
        fun factory(
            application: Application,
            api: ApiService,
            offlineQueue: OfflineQueue,
        ): ViewModelProvider.Factory = viewModelFactory {
            initializer { OvertimeViewModel(application, api, offlineQueue) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OvertimeScreen(container: AppContainer, appVm: AppViewModel) {
    val context = LocalContext.current
    val vm: OvertimeViewModel = viewModel(
        factory = OvertimeViewModel.factory(
            context.applicationContext as Application,
            container.api,
            container.offlineQueue,
        )
    )
    val requests by vm.requests.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val error by vm.error.collectAsState()
    val statusMsg by vm.statusMsg.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    var filter by remember { mutableStateOf("all") }
    var showCreate by remember { mutableStateOf(false) }
    val snackHost = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(error) {
        if (error.isNotEmpty()) snackHost.showSnackbar(error)
    }
    LaunchedEffect(statusMsg) {
        if (statusMsg.isNotEmpty()) snackHost.showSnackbar(statusMsg)
    }

    val filters = listOf("all", "pending", "seen", "approved", "rejected")
    val filtered = if (filter == "all") requests else requests.filter { it.status == filter }

    Scaffold(
        snackbarHost = { SnackbarHost(snackHost) },
        containerColor = colors.bg,
        contentWindowInsets = WindowInsets(0),
    ) { pad ->
        Column(modifier = Modifier.fillMaxSize().padding(pad)) {
            // Filter bar
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(filters) { f ->
                    val label = if (f == "all") strings.all else statusMeta(f, strings).label
                    val active = filter == f
                    Surface(
                        onClick = { filter = f },
                        shape = RoundedCornerShape(99.dp),
                        color = if (active) Primary else colors.card,
                        border = BorderStroke(1.dp, if (active) Primary else colors.border),
                    ) {
                        Text(
                            label,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (active) Color.White else colors.textSecondary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                        )
                    }
                }
            }

            // New request button
            Button(
                onClick = { vm.loadCreateData(); showCreate = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(strings.overtimeNewRequest, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(vertical = 2.dp))
            }

            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Primary)
                }
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
                        items(filtered) { r ->
                            val meta = statusMeta(r.status, strings)
                            val totalHrs = r.items.sumOf { it.extraHours }
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = colors.card),
                                border = BorderStroke(1.dp, colors.border),
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                                        Column {
                                            Text(r.workDate, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                            Text("→ ${r.siteChiefName}", fontSize = 12.sp, color = colors.textSecondary)
                                        }
                                        StatusPill(meta.label, meta.color, meta.bg)
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Text("${r.items.size} isci", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                                        Text("${totalHrs}h jemi", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Primary)
                                    }
                                    if (!r.note.isNullOrEmpty()) Text(r.note, fontSize = 12.sp, color = colors.textMuted)
                                    Text(fmtDate(r.sentAt), fontSize = 11.sp, color = colors.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        CreateRequestDialog(
            vm = vm,
            appVm = appVm,
            strings = strings,
            colors = colors,
            onDismiss = { showCreate = false },
        )
    }
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

@Composable
private fun CreateRequestDialog(
    vm: OvertimeViewModel,
    appVm: AppViewModel,
    strings: AppStrings,
    colors: AppColors,
    onDismiss: () -> Unit,
) {
    val siteChiefs by vm.siteChiefs.collectAsState()
    val workers by vm.myWorkers.collectAsState()
    val shiftMap by vm.shiftSettingsMap.collectAsState()

    var siteChiefId by remember { mutableStateOf("") }
    var workDate by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }
    var note by remember { mutableStateOf("") }
    var selectedWorkers by remember { mutableStateOf(mapOf<String, Double>()) }
    var step by remember { mutableStateOf("form") }
    var saving by remember { mutableStateOf(false) }
    var errMsg by remember { mutableStateOf("") }
    var nfcMode by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Täze Mesai Soragy", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    TextButton(onClick = onDismiss) { Text("✕", color = colors.textMuted, fontSize = 18.sp) }
                }

                if (step == "form") {
                    // ── Step 1: site chief + date + note ──
                    Column(
                        modifier = Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(strings.overtimeSelectSiteChief, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(siteChiefs) { sc ->
                                val active = siteChiefId == sc.id
                                Surface(
                                    onClick = { siteChiefId = sc.id },
                                    shape = RoundedCornerShape(99.dp),
                                    color = if (active) Primary else colors.card2,
                                    border = BorderStroke(1.dp, if (active) Primary else colors.border),
                                ) {
                                    Text(sc.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (active) Color.White else colors.text, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp))
                                }
                            }
                        }

                        Text(strings.overtimeWorkDate, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                        OutlinedTextField(
                            value = workDate, onValueChange = { workDate = it },
                            modifier = Modifier.fillMaxWidth(), singleLine = true,
                            placeholder = { Text("2026-05-15", color = colors.textMuted) },
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Primary, unfocusedBorderColor = colors.border,
                                focusedTextColor = colors.text, unfocusedTextColor = colors.text,
                                focusedContainerColor = colors.card2, unfocusedContainerColor = colors.card2,
                            ),
                        )

                        Text(strings.overtimeNote, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                        OutlinedTextField(
                            value = note, onValueChange = { note = it },
                            modifier = Modifier.fillMaxWidth().height(80.dp), maxLines = 3,
                            placeholder = { Text("Sebäp...", color = colors.textMuted) },
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Primary, unfocusedBorderColor = colors.border,
                                focusedTextColor = colors.text, unfocusedTextColor = colors.text,
                                focusedContainerColor = colors.card2, unfocusedContainerColor = colors.card2,
                            ),
                        )

                        Button(
                            onClick = { step = "workers" }, modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary), shape = RoundedCornerShape(12.dp),
                        ) { Text("${strings.overtimeSelectWorkers} →", fontWeight = FontWeight.Bold) }
                    }
                } else {
                    // ── Step 2: workers (manual OR nfc) ──
                    WorkersStep(
                        workers = workers,
                        selectedWorkers = selectedWorkers,
                        onSelectedChanged = { selectedWorkers = it },
                        nfcMode = nfcMode,
                        onNfcModeChanged = { nfcMode = it },
                        appVm = appVm,
                        shiftMap = shiftMap,
                        colors = colors,
                        strings = strings,
                        errMsg = errMsg,
                        saving = saving,
                        onBack = { step = "form" },
                        onSubmit = {
                            if (siteChiefId.isEmpty()) { errMsg = "Site Chief saýla"; return@WorkersStep }
                            if (selectedWorkers.isEmpty()) { errMsg = "Işçi saýla"; return@WorkersStep }
                            saving = true
                            val items = selectedWorkers.map { (id, hrs) -> CreateExtraRequestItem(id, hrs, null) }
                            vm.createRequest(siteChiefId, workDate, note, items,
                                onSuccess = { saving = false; onDismiss() },
                                onError = { msg -> saving = false; errMsg = msg },
                            )
                        },
                    )
                }
            }
        }
    }
}

// ─── Workers Step ─────────────────────────────────────────────────────────────

@Composable
private fun WorkersStep(
    workers: List<MobileWorker>,
    selectedWorkers: Map<String, Double>,
    onSelectedChanged: (Map<String, Double>) -> Unit,
    nfcMode: Boolean,
    onNfcModeChanged: (Boolean) -> Unit,
    appVm: AppViewModel,
    shiftMap: Map<String, ShiftSetting>,
    colors: AppColors,
    strings: AppStrings,
    errMsg: String,
    saving: Boolean,
    onBack: () -> Unit,
    onSubmit: () -> Unit,
) {
    var linkingUid by remember { mutableStateOf<String?>(null) }
    var scanMsg by remember { mutableStateOf("") }
    var scanMsgIsError by remember { mutableStateOf(false) }

    val nfcUid by appVm.nfcUid.collectAsState()

    LaunchedEffect(nfcUid) {
        val uid = nfcUid ?: return@LaunchedEffect
        if (!nfcMode) { appVm.consumeNfcUid(); return@LaunchedEffect }
        val map = appVm.getCardMap()
        val entityId = map[uid]
        if (entityId != null) {
            val worker = workers.find { it.id == entityId }
            if (worker != null) {
                if (worker.id !in selectedWorkers) {
                    onSelectedChanged(selectedWorkers + (worker.id to 2.0))
                    scanMsg = "✓ ${worker.name} goşuldy"
                    scanMsgIsError = false
                } else {
                    scanMsg = "${worker.name} eýýäm sanawda"
                    scanMsgIsError = false
                }
            } else {
                // Card is known but worker is not in this foreman's brigade
                scanMsg = "Bu işçi siziň brigadaňyzda däl"
                scanMsgIsError = true
            }
        } else {
            linkingUid = uid
        }
        appVm.consumeNfcUid()
    }

    Column(modifier = Modifier.heightIn(max = 440.dp)) {
        // Mode toggle tabs
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(false to "El bilen", true to "NFC Scan").forEach { (isNfc, label) ->
                val active = nfcMode == isNfc
                Surface(
                    onClick = { onNfcModeChanged(isNfc); scanMsg = "" },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    color = if (active) Primary else colors.card2,
                    border = BorderStroke(1.dp, if (active) Primary else colors.border),
                ) {
                    Text(
                        label,
                        modifier = Modifier.padding(vertical = 8.dp).fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) Color.White else colors.textSecondary,
                    )
                }
            }
        }

        if (!nfcMode) {
            // ── Manual selection ──
            Text(
                "${strings.overtimeSelectWorkers} (${selectedWorkers.size} saýlandy)",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(workers) { w ->
                    val sel = w.id in selectedWorkers
                    val hrs = selectedWorkers[w.id] ?: 2.0
                    WorkerItem(w = w, sel = sel, hrs = hrs, shiftMap = shiftMap, colors = colors,
                        onToggle = { onSelectedChanged(if (sel) selectedWorkers - w.id else selectedWorkers + (w.id to 2.0)) },
                        onHrsChange = { onSelectedChanged(selectedWorkers + (w.id to it)) },
                    )
                }
            }
        } else {
            // ── NFC Scan mode ──
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                NfcScanIndicator(colors = colors)

                if (scanMsg.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (scanMsgIsError) DangerLight else SuccessLight,
                        border = BorderStroke(1.dp, if (scanMsgIsError) Danger else Success),
                    ) {
                        Text(
                            scanMsg,
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (scanMsgIsError) Danger else Success,
                        )
                    }
                }

                if (selectedWorkers.isNotEmpty()) {
                    Text("Goşulan işçiler (${selectedWorkers.size}):", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                    LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        val scannedWorkers = workers.filter { it.id in selectedWorkers }
                        items(scannedWorkers) { w ->
                            val hrs = selectedWorkers[w.id] ?: 2.0
                            WorkerItem(w = w, sel = true, hrs = hrs, shiftMap = shiftMap, colors = colors,
                                onToggle = { onSelectedChanged(selectedWorkers - w.id) },
                                onHrsChange = { onSelectedChanged(selectedWorkers + (w.id to it)) },
                            )
                        }
                    }
                }
            }
        }

        if (errMsg.isNotEmpty()) {
            Text(errMsg, fontSize = 12.sp, color = Danger, modifier = Modifier.padding(top = 4.dp))
        }

        Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                Text(strings.overtimeBack, color = colors.text)
            }
            Button(
                onClick = onSubmit,
                modifier = Modifier.weight(2f),
                enabled = !saving,
                colors = ButtonDefaults.buttonColors(containerColor = Primary),
                shape = RoundedCornerShape(12.dp),
            ) {
                if (saving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("${strings.overtimeSend} ✓", fontWeight = FontWeight.Bold)
            }
        }
    }

    linkingUid?.let { uid ->
        LinkCardDialog(
            uid = uid,
            workers = workers,
            colors = colors,
            onDismiss = { linkingUid = null; scanMsg = "Kart baglanmady"; scanMsgIsError = true },
            onLink = { worker ->
                appVm.saveCardMapping(uid, worker.id)
                onSelectedChanged(selectedWorkers + (worker.id to 2.0))
                linkingUid = null
                scanMsg = "✓ ${worker.name} — kart baglanyp goşuldy"
                scanMsgIsError = false
            },
        )
    }
}

// ─── NFC Scan Indicator (pulsing animation) ───────────────────────────────────

@Composable
private fun NfcScanIndicator(colors: AppColors) {
    val infiniteTransition = rememberInfiniteTransition(label = "nfc_pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f, targetValue = 1.18f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "scale",
    )

    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Surface(
            shape = CircleShape,
            color = Primary.copy(alpha = 0.12f),
            modifier = Modifier.size(120.dp).scale(scale),
        ) {}
        Surface(shape = CircleShape, color = Primary.copy(alpha = 0.22f), modifier = Modifier.size(90.dp)) {}
        Surface(shape = CircleShape, color = Primary, modifier = Modifier.size(64.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Text("NFC", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
            }
        }
        Text(
            "Karti ýaklaşdyryň",
            modifier = Modifier.offset(y = 72.dp),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.textSecondary,
        )
    }
    Spacer(Modifier.height(52.dp))
}

// ─── Worker Item row ──────────────────────────────────────────────────────────

/** Returns true if current local time is within the worker's shift hours */
private fun isWithinShift(shiftType: String?, shiftMap: Map<String, ShiftSetting>): Boolean {
    val setting = shiftMap[shiftType ?: return false] ?: return false
    val now = Calendar.getInstance()
    val nowMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    fun parse(t: String) = t.split(":").let { it[0].toInt() * 60 + it[1].toInt() }
    val start = parse(setting.startTime)
    val end   = parse(setting.endTime)
    return if (start <= end) nowMins in start..end
    else nowMins >= start || nowMins <= end // crosses midnight (e.g. 19:00-07:00)
}

@Composable
private fun WorkerItem(
    w: MobileWorker,
    sel: Boolean,
    hrs: Double,
    shiftMap: Map<String, ShiftSetting>,
    colors: AppColors,
    onToggle: () -> Unit,
    onHrsChange: (Double) -> Unit,
) {
    val shiftLabel = when (w.shift) {
        "day"   -> "GÜN"
        "night" -> "GIJE"
        else    -> null
    }
    val setting = shiftMap[w.shift]
    val inShiftNow = isWithinShift(w.shift, shiftMap)

    Surface(
        onClick = onToggle,
        shape = RoundedCornerShape(10.dp),
        color = if (sel) Primary.copy(0.1f) else colors.card2,
        border = BorderStroke(1.dp, if (sel) Primary else colors.border),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = if (sel) Primary else Color.Transparent,
                    border = BorderStroke(2.dp, if (sel) Primary else colors.border),
                    modifier = Modifier.size(22.dp),
                ) {
                    if (sel) Box(contentAlignment = Alignment.Center) {
                        Text("✓", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(w.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(w.workerId, fontSize = 11.sp, color = colors.textMuted)
                        if (shiftLabel != null) {
                            val shiftColor = if (w.shift == "day") Warning else Info
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = shiftColor.copy(alpha = 0.15f),
                            ) {
                                Text(
                                    shiftLabel,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = shiftColor,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                )
                            }
                        }
                        if (setting != null) {
                            Text(
                                "${setting.startTime}–${setting.endTime}",
                                fontSize = 10.sp,
                                color = colors.textMuted,
                            )
                        }
                    }
                }
                if (sel) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { onHrsChange(maxOf(0.5, hrs - 0.5)) }) { Text("−", color = Primary, fontSize = 18.sp) }
                        Text("${hrs}h", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        TextButton(onClick = { onHrsChange(minOf(24.0, hrs + 0.5)) }) { Text("+", color = Primary, fontSize = 18.sp) }
                    }
                }
            }
            // Warn if recording overtime during the worker's regular shift hours
            if (sel && inShiftNow) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = WarningLight,
                ) {
                    Text(
                        "⚠ Bu işçi häzir öz iş wagtynda",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Warning,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}

// ─── Link Card Dialog ─────────────────────────────────────────────────────────

@Composable
private fun LinkCardDialog(
    uid: String,
    workers: List<MobileWorker>,
    colors: AppColors,
    onDismiss: () -> Unit,
    onLink: (MobileWorker) -> Unit,
) {
    var selected by remember { mutableStateOf<MobileWorker?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Nätanyş Kart", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.text)

                Surface(shape = RoundedCornerShape(8.dp), color = colors.card2, border = BorderStroke(1.dp, colors.border)) {
                    Text(
                        uid,
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        fontSize = 12.sp,
                        color = colors.textMuted,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                }

                Text("Bu kartı haýsy işçä degişli?", fontSize = 13.sp, color = colors.textSecondary)

                LazyColumn(
                    modifier = Modifier.heightIn(max = 260.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(workers) { w ->
                        val active = selected?.id == w.id
                        Surface(
                            onClick = { selected = w },
                            shape = RoundedCornerShape(10.dp),
                            color = if (active) Primary.copy(0.12f) else colors.card2,
                            border = BorderStroke(1.dp, if (active) Primary else colors.border),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column {
                                    Text(w.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                                    Text(w.workerId, fontSize = 11.sp, color = colors.textMuted)
                                }
                                if (active) Text("✓", color = Primary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(10.dp)) {
                        Text("Ýatyr", color = colors.text)
                    }
                    Button(
                        onClick = { selected?.let { onLink(it) } },
                        modifier = Modifier.weight(1f),
                        enabled = selected != null,
                        colors = ButtonDefaults.buttonColors(containerColor = Primary),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Bagla", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
