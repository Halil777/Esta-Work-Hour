package com.esta.workforce.ui.foreman.notifications

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.esta.workforce.data.model.LateArrival
import com.esta.workforce.data.model.LateArrivalsResponse
import com.esta.workforce.data.model.MissingCheckout
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtTime(ts: Long): String =
    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))

private fun initials(name: String): String =
    name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("").uppercase()

private fun todayStr(): String {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC+5"))
    cal.add(Calendar.HOUR, 5)
    return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(cal.time)
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class NotificationsViewModel(private val api: ApiService) : ViewModel() {
    private val _missing = MutableStateFlow<List<MissingCheckout>>(emptyList())
    val missing: StateFlow<List<MissingCheckout>> = _missing
    private val _lateData = MutableStateFlow<LateArrivalsResponse?>(null)
    val lateData: StateFlow<LateArrivalsResponse?> = _lateData
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    fun load() {
        viewModelScope.launch {
            try {
                val (mis, late) = listOf(
                    launch { _missing.value = try { api.getMissingCheckouts() } catch (_: Exception) { emptyList() } },
                    launch { _lateData.value = try { api.getLateArrivals() } catch (_: Exception) { null } },
                ).let { jobs -> jobs.forEach { it.join() }; Pair(_missing.value, _lateData.value) }
            } finally {
                _loading.value = false
                _refreshing.value = false
            }
        }
    }

    fun refresh() { _refreshing.value = true; load() }

    fun saveNote(workerEntityId: String, date: String, note: String, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                api.saveAbsenceNote(com.esta.workforce.data.model.AbsenceNoteRequest(workerEntityId, date, note))
                // Update local state
                _lateData.value = _lateData.value?.let { data ->
                    data.copy(workers = data.workers.map { w ->
                        if (w.workerEntityId == workerEntityId)
                            w.copy(absenceNote = com.esta.workforce.data.model.LateArrivalAbsenceNote(note, "Sen", ""))
                        else w
                    })
                }
                onDone()
            } catch (_: Exception) {}
        }
    }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { NotificationsViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(container: AppContainer) {
    val vm: NotificationsViewModel = viewModel(factory = NotificationsViewModel.factory(container.api))
    val missing by vm.missing.collectAsState()
    val lateData by vm.lateData.collectAsState()
    val loading by vm.loading.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    var noteWorker by remember { mutableStateOf<LateArrival?>(null) }
    val today = remember { todayStr() }

    LaunchedEffect(Unit) { vm.load() }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary)
        }
        return
    }

    val late = lateData?.workers ?: emptyList()
    val hasAnything = missing.isNotEmpty() || late.isNotEmpty()

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { vm.refresh() },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            if (!hasAnything) {
                item {
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = colors.card),
                        border = BorderStroke(1.dp, colors.border),
                        modifier = Modifier.padding(top = 40.dp),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text("✅", fontSize = 48.sp)
                            Text(strings.notifNoItems, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)
                            Text(
                                "Ahli isciler wagtynda geldiler we cykyslary belledi.",
                                fontSize = 13.sp,
                                color = colors.textMuted,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }

            // Late arrivals
            if (late.isNotEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = WarningLight),
                        border = BorderStroke(1.dp, Warning.copy(alpha = 0.4f)),
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("⏰", fontSize = 26.sp)
                            Column {
                                Text("${late.size} ${strings.notifLateTitle}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Warning)
                                Text("Is baslangyc wagtyna cenli giris yok", fontSize = 12.sp, color = Warning)
                            }
                        }
                    }
                }

                val dayLate = late.filter { it.shift == "day" }
                val nightLate = late.filter { it.shift == "night" }
                val noShift = late.filter { it.shift == null }

                val groups = listOf(
                    Triple("Gundiz shift", dayLate, "day"),
                    Triple("Gije shift", nightLate, "night"),
                    Triple("Shift bellenmay", noShift, null as String?),
                )

                groups.forEach { (label, list, shift) ->
                    if (list.isEmpty()) return@forEach
                    val deadline = shift?.let { s ->
                        val settings = if (s == "day") lateData?.daySettings else lateData?.nightSettings
                        settings?.let {
                            val parts = it.startTime.split(":").map { p -> p.toIntOrNull() ?: 0 }
                            val total = parts[0] * 60 + (parts.getOrElse(1) { 0 }) + (it.graceMinutes ?: 60)
                            "${total / 60}:${(total % 60).toString().padStart(2, '0')}"
                        }
                    }
                    item {
                        Text(
                            "$label${if (deadline != null) " (termin: $deadline)" else ""}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.textMuted,
                            modifier = Modifier.padding(horizontal = 2.dp),
                        )
                    }
                    items(list) { w ->
                        LateWorkerCard(w, colors, strings, onNoteClick = { noteWorker = w })
                    }
                }
            }

            // Missing checkouts
            if (missing.isNotEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = DangerLight),
                        border = BorderStroke(1.dp, Danger.copy(alpha = 0.4f)),
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("⚠️", fontSize = 26.sp)
                            Column {
                                Text("${missing.size} ${strings.notifMissingTitle}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Danger)
                                Text("Ise gelen wagtdan 14+ sagat geci", fontSize = 12.sp, color = Danger)
                            }
                        }
                    }
                }
                items(missing) { w -> MissingWorkerCard(w, colors) }
            }
        }
    }

    // Note modal
    noteWorker?.let { worker ->
        NoteModal(
            worker = worker,
            colors = colors,
            strings = strings,
            onDismiss = { noteWorker = null },
            onSave = { note ->
                vm.saveNote(worker.workerEntityId, today, note) { noteWorker = null }
            },
        )
    }
}

@Composable
private fun LateWorkerCard(
    w: LateArrival,
    colors: AppColors,
    strings: AppStrings,
    onNoteClick: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = colors.card),
        border = BorderStroke(1.dp, Warning.copy(alpha = 0.4f)),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    shape = RoundedCornerShape(99.dp),
                    color = Warning.copy(alpha = 0.2f),
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(initials(w.workerName), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Warning)
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(w.workerName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                        if (w.isStaff) {
                            Surface(shape = RoundedCornerShape(99.dp), color = InfoLight) {
                                Text("STAFF", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Info, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                    }
                    Text("${w.workerId}${if (!w.profession.isNullOrEmpty()) " · ${w.profession}" else ""}", fontSize = 11.sp, color = colors.textMuted)
                    if (!w.brigadeName.isNullOrEmpty()) Text(w.brigadeName, fontSize = 11.sp, color = colors.textMuted)
                }
                Surface(
                    onClick = onNoteClick,
                    shape = RoundedCornerShape(10.dp),
                    color = if (w.absenceNote != null) SuccessLight else WarningLight,
                    border = BorderStroke(1.dp, if (w.absenceNote != null) Success.copy(0.5f) else Warning.copy(0.5f)),
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(if (w.absenceNote != null) "✏️" else "📝", fontSize = 16.sp)
                        Text(
                            if (w.absenceNote != null) strings.notifNoteExists else strings.notifAddNote,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (w.absenceNote != null) Success else Warning,
                        )
                    }
                }
            }
            if (w.absenceNote != null) {
                Surface(shape = RoundedCornerShape(8.dp), color = SuccessLight, border = BorderStroke(1.dp, Success.copy(0.3f))) {
                    Text(
                        "${w.absenceNote.createdByName}: \"${w.absenceNote.note}\"",
                        fontSize = 11.sp, color = Success, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(8.dp),
                    )
                }
            }
            Row(modifier = Modifier.padding(top = 4.dp)) {
                Surface(shape = RoundedCornerShape(99.dp), color = WarningLight) {
                    Text(strings.notifNoEntry, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Warning, modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp))
                }
            }
        }
    }
}

@Composable
private fun MissingWorkerCard(w: MissingCheckout, colors: AppColors) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = colors.card),
        border = BorderStroke(1.dp, Danger.copy(alpha = 0.3f)),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(99.dp), color = Danger.copy(0.2f), modifier = Modifier.size(40.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(initials(w.workerName), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Danger)
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(w.workerName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                    Text("${w.workerId}${if (!w.profession.isNullOrEmpty()) " · ${w.profession}" else ""}", fontSize = 11.sp, color = colors.textMuted)
                    if (!w.brigadeName.isNullOrEmpty()) Text(w.brigadeName, fontSize = 11.sp, color = colors.textMuted)
                }
                Surface(shape = RoundedCornerShape(10.dp), color = Danger.copy(0.2f)) {
                    Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${w.hoursAgo.toInt()}h", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Danger)
                        Text("işde", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Danger)
                    }
                }
            }
            HorizontalDivider(color = colors.border, thickness = 0.5.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Giris wagty:", fontSize = 12.sp, color = colors.textMuted)
                Text(fmtTime(w.checkInTime), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
                Spacer(Modifier.weight(1f))
                Surface(shape = RoundedCornerShape(99.dp), color = DangerLight) {
                    Text("Cykys yok", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Danger, modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp))
                }
            }
        }
    }
}

@Composable
private fun NoteModal(
    worker: LateArrival,
    colors: AppColors,
    strings: AppStrings,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var note by remember(worker.workerEntityId) { mutableStateOf(worker.absenceNote?.note ?: "") }
    var saving by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = colors.card)) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("Sebap yaz", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Text("${worker.workerName} · ${worker.brigadeName}", fontSize = 13.sp, color = colors.textMuted)
                OutlinedTextField(
                    value = note, onValueChange = { note = it },
                    modifier = Modifier.fillMaxWidth().height(90.dp),
                    placeholder = { Text(strings.notifNoteHint, color = colors.textMuted) },
                    maxLines = 4,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Primary, unfocusedBorderColor = colors.border,
                        focusedTextColor = colors.text, unfocusedTextColor = colors.text,
                        focusedContainerColor = colors.bg, unfocusedContainerColor = colors.bg,
                    ),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, colors.border)) {
                        Text(strings.cancel, color = colors.textMuted)
                    }
                    Button(
                        onClick = { saving = true; onSave(note) },
                        modifier = Modifier.weight(1f),
                        enabled = !saving && note.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = Primary),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        if (saving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        else Text(strings.notifSaveNote, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
