package com.workhour.worker.ui.calendar

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val monthDisplayFmt = SimpleDateFormat("MMMM yyyy", Locale.US)
private val parseFmt        = SimpleDateFormat("yyyy-MM", Locale.US)
private val parseDateFmt    = SimpleDateFormat("yyyy-MM-dd", Locale.US)
private val dayDispFmt      = SimpleDateFormat("EEEE, MMMM d", Locale.US)
private val timeFmt         = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = TimeZone.getTimeZone("GMT+3") }


@Composable
fun CalendarScreen(serverUrl: String) {
    val s = LocalStrings.current
    val vm: CalendarViewModel = viewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(serverUrl) { vm.load(serverUrl) }

    val recordMap = remember(state.records) {
        state.records.associateBy { it.date }
    }
    val today = remember { parseDateFmt.format(Date()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDeep)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Header
        Text(
            s.workCalendar,
            style = MaterialTheme.typography.titleLarge,
            color = TextPrimary,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp, bottom = 4.dp),
        )

        // ── Month navigator
        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(BgCard)
                .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                .padding(horizontal = 4.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { vm.prevMonth(serverUrl) }) {
                Icon(Icons.Outlined.ChevronLeft, null, tint = TextSecondary)
            }
            Text(
                state.month.toDisplayMonth(),
                style = MaterialTheme.typography.titleSmall,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
            )
            val isCurrentMonth = state.month == SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
            IconButton(
                onClick = { vm.nextMonth(serverUrl) },
                enabled = !isCurrentMonth,
            ) {
                Icon(
                    Icons.Outlined.ChevronRight,
                    null,
                    tint = if (isCurrentMonth) TextMuted else TextSecondary,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // ── Summary chips
        if (!state.loading) {
            Row(
                modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                SummaryChip(
                    "${state.presentDays}", s.daysPresent,
                    GreenSuccess, GreenDim.copy(0.3f), Modifier.weight(1f),
                )
                SummaryChip(
                    "${state.totalMinutes / 60}h ${state.totalMinutes % 60}m", s.totalHours,
                    AccentPurple, AccentPurpleDim.copy(0.3f), Modifier.weight(1f),
                )
            }
            Spacer(Modifier.height(16.dp))
        }

        // ── Calendar grid card
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(BgCard)
                .border(1.dp, BorderSubtle, RoundedCornerShape(16.dp))
                .padding(14.dp),
        ) {
            if (state.loading) {
                Box(Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Day-of-week headers
                    Row(Modifier.fillMaxWidth()) {
                        s.dayHeaders.forEach { d ->
                            Text(
                                d,
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                color = TextMuted,
                                textAlign = TextAlign.Center,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }

                    Spacer(Modifier.height(6.dp))

                    // Grid rows
                    val (year, month) = state.month.split("-").map { it.toInt() }
                    val grid = buildMonthGrid(year, month)
                    grid.chunked(7).forEach { week ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            week.forEach { dateStr ->
                                if (dateStr == null) {
                                    Spacer(Modifier.weight(1f))
                                } else {
                                    val record = recordMap[dateStr]
                                    val isSelected = state.selectedDate == dateStr
                                    val isToday = dateStr == today
                                    DayCell(
                                        dateStr  = dateStr,
                                        record   = record,
                                        isToday  = isToday,
                                        selected = isSelected,
                                        onClick  = { vm.selectDate(dateStr) },
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Selected day detail
        AnimatedVisibility(
            visible = state.selectedDate != null,
            enter   = expandVertically() + fadeIn(),
            exit    = shrinkVertically() + fadeOut(),
        ) {
            state.selectedDate?.let { date ->
                DayDetailCard(
                    date   = date,
                    record = recordMap[date],
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                )
            }
        }

        // ── Legend
        Row(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LegendDot(GreenSuccess, s.present)
            LegendDot(OrangeWarning, s.partial)
            LegendDot(BorderSubtle, s.noRecord)
        }

        // ── Error
        if (state.error.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(RedDim.copy(0.3f))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = RedDanger, modifier = Modifier.size(16.dp))
                Text(state.error, style = MaterialTheme.typography.bodySmall, color = RedDanger)
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

// ─── Day cell ────────────────────────────────────────────────────────────────

@Composable
private fun DayCell(
    dateStr: String,
    record: AttendanceRecord?,
    isToday: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val day = dateStr.split("-").last().trimStart('0').ifEmpty { "0" }
    val dotColor = when (record?.status) {
        "present" -> GreenSuccess
        "partial" -> OrangeWarning
        else      -> Color.Transparent
    }
    val bgColor = when {
        selected -> AccentPurple
        isToday  -> AccentPurpleDim.copy(0.25f)
        else     -> Color.Transparent
    }
    val textColor = when {
        selected -> TextPrimary
        isToday  -> AccentPurple
        else     -> TextPrimary
    }
    val hasFuture = try { dateStr > parseDateFmt.format(Date()) } catch (_: Exception) { false }

    Column(
        modifier = modifier
            .aspectRatio(0.75f)
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .then(
                if (isToday && !selected)
                    Modifier.border(1.dp, AccentPurple.copy(0.5f), RoundedCornerShape(8.dp))
                else Modifier
            )
            .clickable(enabled = !hasFuture) { onClick() }
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            day,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
            color = if (hasFuture) TextMuted else textColor,
            fontWeight = if (isToday || selected) FontWeight.Bold else FontWeight.Normal,
        )
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .size(5.dp)
                .clip(CircleShape)
                .background(if (selected) TextPrimary.copy(0.7f) else dotColor),
        )
    }
}

// ─── Day detail card ─────────────────────────────────────────────────────────

@Composable
private fun DayDetailCard(date: String, record: AttendanceRecord?, modifier: Modifier = Modifier) {
    val s = LocalStrings.current
    val displayDate = try { dayDispFmt.format(parseDateFmt.parse(date)!!) } catch (_: Exception) { date }
    val (accentColor, statusLabel, statusIcon) = when (record?.status) {
        "present" -> Triple(GreenSuccess, s.present, Icons.Outlined.CheckCircleOutline)
        "partial" -> Triple(OrangeWarning, s.inProgress, Icons.Outlined.Schedule)
        else      -> Triple(TextMuted, s.noRecord, Icons.Outlined.RemoveCircleOutline)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.verticalGradient(listOf(accentColor.copy(0.1f), BgCard)))
            .border(1.dp, accentColor.copy(0.3f), RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Title row
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(displayDate, style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(accentColor.copy(0.12f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Icon(statusIcon, null, tint = accentColor, modifier = Modifier.size(12.dp))
                Text(statusLabel, style = MaterialTheme.typography.labelSmall, color = accentColor)
            }
        }

        if (record != null && record.status != "absent") {
            HorizontalDivider(color = BorderSubtle)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                // Check-in
                DetailItem(
                    label = "Check In",
                    value = record.checkIn?.let { timeFmt.format(Date(it)) } ?: "—",
                    color = GreenSuccess,
                    icon  = Icons.Outlined.Login,
                )
                // Divider
                Box(Modifier.width(1.dp).height(40.dp).background(BorderSubtle))
                // Check-out
                DetailItem(
                    label = "Check Out",
                    value = record.checkOut?.let { timeFmt.format(Date(it)) } ?: "—",
                    color = AccentBlue,
                    icon  = Icons.Outlined.Logout,
                )
                // Divider
                Box(Modifier.width(1.dp).height(40.dp).background(BorderSubtle))
                // Duration
                DetailItem(
                    label = "Duration",
                    value = record.totalMinutes?.let { "${it / 60}h ${it % 60}m" } ?: "—",
                    color = AccentPurple,
                    icon  = Icons.Outlined.Timer,
                )
            }
        } else {
            Text(s.noAttendanceRecorded, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        }
    }
}

@Composable
private fun DetailItem(label: String, value: String, color: Color, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(14.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp), color = TextSecondary)
    }
}

// ─── Legend & summary ────────────────────────────────────────────────────────

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
    }
}

@Composable
private fun SummaryChip(value: String, label: String, color: Color, bg: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, color.copy(0.3f), RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = color.copy(0.7f))
    }
}

// ─── Calendar grid builder ───────────────────────────────────────────────────

private fun buildMonthGrid(year: Int, month: Int): List<String?> {
    val cal = Calendar.getInstance()
    cal.set(year, month - 1, 1)
    // Offset: Monday = 0 start
    val rawDow = cal.get(Calendar.DAY_OF_WEEK)          // Sun=1 Mon=2 … Sat=7
    val offset  = (rawDow - Calendar.MONDAY + 7) % 7   // Mon→0, Tue→1, … Sun→6
    val days    = cal.getActualMaximum(Calendar.DAY_OF_MONTH)

    val result = mutableListOf<String?>()
    repeat(offset) { result.add(null) }
    repeat(days) { d ->
        val mm = month.toString().padStart(2, '0')
        val dd = (d + 1).toString().padStart(2, '0')
        result.add("$year-$mm-$dd")
    }
    while (result.size % 7 != 0) result.add(null)
    return result
}

private fun String.toDisplayMonth(): String = try {
    monthDisplayFmt.format(parseFmt.parse(this)!!)
} catch (_: Exception) { this }
