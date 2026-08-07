package com.workhour.worker.ui.history

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val TZ_UTC3      = TimeZone.getTimeZone("GMT+3")
private val timeFmt      = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = TZ_UTC3 }
private val monthDisp    = SimpleDateFormat("MMMM yyyy", Locale.US)
private val dayDisp      = SimpleDateFormat("EEE, MMM d", Locale.US)
private val parseFmt     = SimpleDateFormat("yyyy-MM", Locale.US)
private val parseDateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

@Composable
fun HistoryScreen(serverUrl: String, workerEntityId: String) {
    val c  = LocalAppColors.current
    val vm: HistoryViewModel = viewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(serverUrl) { vm.load(serverUrl, workerEntityId) }

    Column(modifier = Modifier.fillMaxSize().background(c.bgDeep)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Attendance History", style = MaterialTheme.typography.titleLarge, color = c.textPrimary)
        }

        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp).fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(c.bgCard)
                .border(1.dp, c.borderSubtle, RoundedCornerShape(12.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { vm.prevMonth(serverUrl) }) {
                Icon(Icons.Outlined.ChevronLeft, null, tint = c.textSecondary)
            }
            Text(state.month.toMonthDisplay(), style = MaterialTheme.typography.titleSmall, color = c.textPrimary, fontWeight = FontWeight.SemiBold)
            val isCurrentMonth = state.month == SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
            IconButton(onClick = { vm.nextMonth(serverUrl) }, enabled = !isCurrentMonth) {
                Icon(Icons.Outlined.ChevronRight, null, tint = if (isCurrentMonth) c.textMuted else c.textSecondary)
            }
        }

        Spacer(Modifier.height(12.dp))

        if (!state.loading && state.records.isNotEmpty()) {
            Row(
                modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                SummaryChip("${state.presentDays}", "Days Present", GreenSuccess, c.greenDim.copy(0.3f), Modifier.weight(1f))
                SummaryChip("${state.totalMinutes / 60}h ${state.totalMinutes % 60}m", "Total Hours", AccentPurple, AccentPurpleDim.copy(0.3f), Modifier.weight(1f))
            }
            Spacer(Modifier.height(16.dp))
        }

        when {
            state.loading -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }
            state.error.isNotEmpty() -> Box(Modifier.fillMaxWidth().weight(1f).padding(32.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Outlined.CloudOff, null, tint = c.textMuted, modifier = Modifier.size(40.dp))
                    Text(state.error, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                    TextButton(onClick = { vm.load(serverUrl, state.workerEntityId, state.month) }) {
                        Text("Retry", color = AccentPurple)
                    }
                }
            }
            state.records.isEmpty() -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.EventBusy, null, tint = c.textMuted, modifier = Modifier.size(40.dp))
                    Text("No attendance records", color = c.textMuted, style = MaterialTheme.typography.bodyMedium)
                }
            }
            else -> LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(state.records, key = { it.date }) { record ->
                    AttendanceItem(record, c)
                }
            }
        }
    }
}

@Composable
private fun SummaryChip(value: String, label: String, color: Color, bg: Color, modifier: Modifier = Modifier) {
    val c = LocalAppColors.current
    Column(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(bg).border(1.dp, color.copy(0.3f), RoundedCornerShape(12.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = color.copy(0.7f))
    }
}

@Composable
private fun AttendanceItem(record: AttendanceRecord, c: AppColors) {
    val (statusColor, statusBg, statusLabel) = when (record.status) {
        "present" -> Triple(GreenSuccess, c.greenDim.copy(0.25f), "Present")
        "partial"  -> Triple(OrangeWarning, c.orangeDim.copy(0.25f), "Partial")
        else       -> Triple(c.textMuted, c.borderSubtle.copy(0.3f), "Absent")
    }
    val dateLabel = try { dayDisp.format(parseDateFmt.parse(record.date)!!) } catch (_: Exception) { record.date }

    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.bgCard).border(1.dp, c.borderSubtle, RoundedCornerShape(12.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(statusBg),
                contentAlignment = Alignment.Center,
            ) {
                val icon = when (record.status) {
                    "present" -> Icons.Outlined.CheckCircleOutline
                    "partial"  -> Icons.Outlined.Schedule
                    else       -> Icons.Outlined.RemoveCircleOutline
                }
                Icon(icon, null, tint = statusColor, modifier = Modifier.size(18.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(dateLabel, style = MaterialTheme.typography.titleSmall, color = c.textPrimary)
                if (record.checkIn != null) {
                    Text(
                        buildString {
                            append(timeFmt.format(Date(record.checkIn)))
                            if (record.checkOut != null) append(" → ${timeFmt.format(Date(record.checkOut))}")
                        },
                        style = MaterialTheme.typography.bodySmall, color = c.textSecondary,
                    )
                } else {
                    Text("No scan", style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                }
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (record.totalMinutes != null && record.totalMinutes > 0) {
                Text("${record.totalMinutes / 60}h ${record.totalMinutes % 60}m", style = MaterialTheme.typography.titleSmall, color = c.textPrimary, fontWeight = FontWeight.SemiBold)
            }
            Text(statusLabel, style = MaterialTheme.typography.labelSmall, color = statusColor)
        }
    }
}

private fun String.toMonthDisplay(): String = try {
    monthDisp.format(parseFmt.parse(this)!!)
} catch (_: Exception) { this }
