package com.esta.workforce.ui.foreman.brigades

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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
import com.esta.workforce.data.model.UnassignedWorker
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

private fun fmtTime(ts: Long?): String? {
    if (ts == null || ts == 0L) return null
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class BrigadesViewModel(private val api: ApiService) : ViewModel() {
    private val _myWorkers = MutableStateFlow<List<MobileWorker>>(emptyList())
    val myWorkers: StateFlow<List<MobileWorker>> = _myWorkers

    private val _unassigned = MutableStateFlow<List<UnassignedWorker>>(emptyList())
    val unassigned: StateFlow<List<UnassignedWorker>> = _unassigned

    private val _myLoading = MutableStateFlow(true)
    val myLoading: StateFlow<Boolean> = _myLoading

    private val _unLoading = MutableStateFlow(true)
    val unLoading: StateFlow<Boolean> = _unLoading

    private val _shiftSaving = MutableStateFlow<String?>(null)
    val shiftSaving: StateFlow<String?> = _shiftSaving

    private val _addSaving = MutableStateFlow(false)
    val addSaving: StateFlow<Boolean> = _addSaving

    private val _error = MutableStateFlow("")
    val error: StateFlow<String> = _error

    fun loadMyWorkers(cached: List<MobileWorker> = emptyList()) {
        if (cached.isNotEmpty() && _myWorkers.value.isEmpty()) _myWorkers.value = cached
        viewModelScope.launch {
            try {
                _myWorkers.value = api.getMyWorkers()
            } catch (_: Exception) {
            } finally {
                _myLoading.value = false
            }
        }
    }

    fun loadUnassigned() {
        viewModelScope.launch {
            try {
                _unassigned.value = api.getUnassignedWorkers()
            } catch (_: Exception) {
            } finally {
                _unLoading.value = false
            }
        }
    }

    fun releaseWorker(id: String, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                api.releaseWorker(id)
                _myWorkers.value = _myWorkers.value.filter { it.id != id }
                loadUnassigned()
            } catch (e: Exception) {
                onError(e.message ?: "Yalnyslyk")
            }
        }
    }

    fun setShift(id: String, shift: String) {
        _shiftSaving.value = id
        viewModelScope.launch {
            try {
                val updated = api.setShift(id, com.esta.workforce.data.model.SetShiftRequest(shift))
                _myWorkers.value = _myWorkers.value.map { if (it.id == updated.id) updated else it }
            } catch (_: Exception) {
            } finally {
                _shiftSaving.value = null
            }
        }
    }

    fun claimBulk(ids: List<String>, shift: String, onDone: (Int) -> Unit, onError: (String) -> Unit) {
        _addSaving.value = true
        viewModelScope.launch {
            try {
                val added = api.claimBulk(com.esta.workforce.data.model.ClaimBulkRequest(ids, shift))
                _myWorkers.value = _myWorkers.value + added
                _unassigned.value = _unassigned.value.filter { it.id !in ids }
                onDone(added.size)
            } catch (e: Exception) {
                onError(e.message ?: "Yalnyslyk")
            } finally {
                _addSaving.value = false
            }
        }
    }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { BrigadesViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@Composable
fun BrigadesScreen(container: AppContainer) {
    val vm: BrigadesViewModel = viewModel(factory = BrigadesViewModel.factory(container.api))
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    var tab by remember { mutableStateOf("my") }
    var confirmRelease by remember { mutableStateOf<MobileWorker?>(null) }
    var releaseError by remember { mutableStateOf("") }
    var addSuccess by remember { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        vm.loadMyWorkers()
        vm.loadUnassigned()
    }

    LaunchedEffect(releaseError) {
        if (releaseError.isNotEmpty()) { snackbarHostState.showSnackbar(releaseError); releaseError = "" }
    }
    LaunchedEffect(addSuccess) {
        if (addSuccess.isNotEmpty()) { snackbarHostState.showSnackbar(addSuccess); addSuccess = "" }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = colors.bg,
        contentWindowInsets = WindowInsets(0),
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            // Tab bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min),
            ) {
                listOf("my" to strings.brigMyWorkers, "add" to strings.brigAddWorkers).forEach { (key, label) ->
                    val active = tab == key
                    Surface(
                        onClick = { tab = key },
                        modifier = Modifier.weight(1f),
                        color = colors.card,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    label,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (active) Primary else colors.textSecondary,
                                    modifier = Modifier.padding(vertical = 13.dp),
                                )
                                if (active) {
                                    Divider(color = Primary, thickness = 2.dp)
                                } else {
                                    Divider(color = colors.border, thickness = 1.dp)
                                }
                            }
                        }
                    }
                }
            }

            // Content
            if (tab == "my") {
                MyWorkersTab(vm = vm, strings = strings, colors = colors, onConfirmRelease = { confirmRelease = it })
            } else {
                AddWorkersTab(vm = vm, strings = strings, colors = colors, onAdded = { count ->
                    addSuccess = "$count isci sanawynyza gosuldy"
                    tab = "my"
                }, onError = { releaseError = it })
            }
        }
    }

    // Confirm release dialog
    confirmRelease?.let { worker ->
        AlertDialog(
            onDismissRequest = { confirmRelease = null },
            title = { Text(strings.brigRelease) },
            text = { Text("${worker.name} ${strings.brigReleaseConfirm}") },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.releaseWorker(worker.id) { err -> releaseError = err }
                        confirmRelease = null
                    },
                ) {
                    Text("Ayr", color = Danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmRelease = null }) { Text("Yok") }
            },
        )
    }
}

@Composable
private fun MyWorkersTab(
    vm: BrigadesViewModel,
    strings: com.esta.workforce.ui.theme.AppStrings,
    colors: com.esta.workforce.ui.theme.AppColors,
    onConfirmRelease: (MobileWorker) -> Unit,
) {
    val workers by vm.myWorkers.collectAsState()
    val loading by vm.myLoading.collectAsState()
    val shiftSaving by vm.shiftSaving.collectAsState()

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary)
        }
        return
    }

    if (workers.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("👷", fontSize = 48.sp)
                Text(strings.brigNoWorkers, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Text(strings.brigNoWorkersHint, fontSize = 13.sp, color = colors.textMuted)
            }
        }
        return
    }

    val present = workers.filter { it.lastCheckIn != null }
    val absent = workers.filter { it.lastCheckIn == null }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Stats bar
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = colors.card),
                border = BorderStroke(1.dp, colors.border),
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(present.size.toString(), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Success)
                        Text("Isde", fontSize = 11.sp, color = colors.textMuted)
                    }
                    Divider(modifier = Modifier.width(1.dp).fillMaxHeight(), color = colors.border)
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(absent.size.toString(), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Danger)
                        Text("Gelmedi", fontSize = 11.sp, color = colors.textMuted)
                    }
                    Divider(modifier = Modifier.width(1.dp).fillMaxHeight(), color = colors.border)
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(workers.size.toString(), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
                        Text("Jemi", fontSize = 11.sp, color = colors.textMuted)
                    }
                }
            }
        }

        // Day workers
        val dayWorkers = workers.filter { it.shift == "day" }
        val nightWorkers = workers.filter { it.shift == "night" }
        val unshifted = workers.filter { it.shift == null }

        if (dayWorkers.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("☀", fontSize = 15.sp)
                    Text("${strings.shiftDay} (${dayWorkers.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Warning)
                }
            }
            items(dayWorkers) { w -> WorkerCard(w, shiftSaving, vm, colors, onConfirmRelease) }
        }
        if (nightWorkers.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("🌙", fontSize = 15.sp)
                    Text("${strings.shiftNight} (${nightWorkers.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Info)
                }
            }
            items(nightWorkers) { w -> WorkerCard(w, shiftSaving, vm, colors, onConfirmRelease) }
        }
        if (unshifted.isNotEmpty()) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("⏳", fontSize = 15.sp)
                    Text("${strings.shiftNone} (${unshifted.size})", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = colors.textSecondary)
                }
            }
            items(unshifted) { w -> WorkerCard(w, shiftSaving, vm, colors, onConfirmRelease) }
        }
    }
}

@Composable
private fun WorkerCard(
    w: MobileWorker,
    shiftSaving: String?,
    vm: BrigadesViewModel,
    colors: com.esta.workforce.ui.theme.AppColors,
    onConfirmRelease: (MobileWorker) -> Unit,
) {
    val checkedIn = w.lastCheckIn != null
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.card),
        border = BorderStroke(1.dp, if (checkedIn) SuccessLight else colors.border),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(w.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    Text("${w.workerId}${if (!w.profession.isNullOrEmpty()) " · ${w.profession}" else ""}", fontSize = 11.sp, color = colors.textMuted)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Surface(
                        shape = RoundedCornerShape(99.dp),
                        color = if (checkedIn) SuccessLight else DangerLight,
                    ) {
                        Text(
                            text = if (checkedIn) "✓ ${fmtTime(w.lastCheckIn) ?: "Isde"}" else "✗ Gelmedi",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (checkedIn) Success else Danger,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    IconButton(
                        onClick = { onConfirmRelease(w) },
                        modifier = Modifier.size(28.dp),
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = "Remove", tint = Danger, modifier = Modifier.size(16.dp))
                    }
                }
            }
            // Shift buttons
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("day" to "☀ Gundiz", "night" to "🌙 Gije").forEach { (shiftKey, label) ->
                    val active = w.shift == shiftKey
                    val shiftColor = if (shiftKey == "day") Warning else Info
                    Surface(
                        onClick = { if (!active && shiftSaving == null) vm.setShift(w.id, shiftKey) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        color = if (active) shiftColor.copy(alpha = 0.2f) else colors.card2,
                        border = BorderStroke(1.dp, if (active) shiftColor else colors.border),
                        enabled = shiftSaving == null,
                    ) {
                        Row(
                            modifier = Modifier.padding(vertical = 7.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (active) shiftColor else colors.textSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AddWorkersTab(
    vm: BrigadesViewModel,
    strings: com.esta.workforce.ui.theme.AppStrings,
    colors: com.esta.workforce.ui.theme.AppColors,
    onAdded: (Int) -> Unit,
    onError: (String) -> Unit,
) {
    val unassigned by vm.unassigned.collectAsState()
    val loading by vm.unLoading.collectAsState()
    val saving by vm.addSaving.collectAsState()

    var search by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf(setOf<String>()) }

    val filtered = unassigned.filter {
        search.isBlank() || it.name.contains(search, ignoreCase = true) ||
                it.workerId.contains(search, ignoreCase = true) ||
                it.profession.orEmpty().contains(search, ignoreCase = true)
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Primary)
        }
        return
    }

    if (unassigned.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("✅", fontSize = 40.sp)
                Spacer(Modifier.height(12.dp))
                Text(strings.brigAllAssigned, fontSize = 14.sp, color = colors.textMuted)
            }
        }
        return
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column {
            // Search + select all
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(strings.search, color = colors.textMuted) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Primary,
                        unfocusedBorderColor = colors.border,
                        focusedTextColor = colors.text,
                        unfocusedTextColor = colors.text,
                        focusedContainerColor = colors.card2,
                        unfocusedContainerColor = colors.card2,
                    ),
                )
                OutlinedButton(
                    onClick = {
                        selected = if (selected.size == filtered.size && filtered.isNotEmpty())
                            emptySet() else filtered.map { it.id }.toSet()
                    },
                    border = BorderStroke(1.dp, colors.border),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        if (selected.size == filtered.size && filtered.isNotEmpty()) "Ayr" else "Hemme",
                        color = Primary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Text(
                "${filtered.size} isci · ${selected.size} saylandy",
                fontSize = 12.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 6.dp),
            )
            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = if (selected.isNotEmpty()) 120.dp else 16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(filtered) { w ->
                    val sel = w.id in selected
                    Surface(
                        onClick = { selected = if (sel) selected - w.id else selected + w.id },
                        shape = RoundedCornerShape(10.dp),
                        color = if (sel) Primary.copy(alpha = 0.1f) else colors.card,
                        border = BorderStroke(1.dp, if (sel) Primary else colors.border),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = if (sel) Primary else Color.Transparent,
                                border = BorderStroke(2.dp, if (sel) Primary else colors.border),
                                modifier = Modifier.size(22.dp),
                            ) {
                                if (sel) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("✓", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(w.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                Text(
                                    "${w.workerId}${if (!w.profession.isNullOrEmpty()) " · ${w.profession}" else ""}${if (!w.brigadeName.isNullOrEmpty()) " · ${w.brigadeName}" else ""}",
                                    fontSize = 11.sp,
                                    color = colors.textMuted,
                                )
                            }
                        }
                    }
                }
            }
        }

        // Bottom action bar
        if (selected.isNotEmpty()) {
            Surface(
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
                color = colors.card,
                shadowElevation = 8.dp,
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${selected.size} saylandy", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = colors.text, modifier = Modifier.weight(1f))
                    Button(
                        onClick = { vm.claimBulk(selected.toList(), "day", { count -> onAdded(count) }, onError) },
                        enabled = !saving,
                        colors = ButtonDefaults.buttonColors(containerColor = Warning),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        if (saving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        else Text("☀ ${strings.brigAddDay}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { vm.claimBulk(selected.toList(), "night", { count -> onAdded(count) }, onError) },
                        enabled = !saving,
                        colors = ButtonDefaults.buttonColors(containerColor = Info),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        if (saving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        else Text("🌙 ${strings.brigAddNight}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
