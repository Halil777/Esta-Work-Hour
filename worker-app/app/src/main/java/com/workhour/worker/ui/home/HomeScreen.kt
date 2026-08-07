package com.workhour.worker.ui.home

import androidx.compose.animation.core.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.data.model.AttendanceRecord
import com.workhour.worker.ui.theme.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

private val TZ_UTC3  = TimeZone.getTimeZone("GMT+3")
private val timeFmt  = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = TZ_UTC3 }
private val dateFmt  = SimpleDateFormat("EEEE, MMMM d", Locale.US)
private val dayFmt   = SimpleDateFormat("EEE", Locale.US)
private val parseFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

@Composable
fun HomeScreen(serverUrl: String, workerName: String) {
    val vm: HomeViewModel = viewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    // Live clock that ticks every minute for elapsed time display
    var tick by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) { delay(60_000L); tick = System.currentTimeMillis() }
    }

    LaunchedEffect(serverUrl) { vm.load(serverUrl, workerName) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDeep)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Top bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 20.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(greeting(), style = MaterialTheme.typography.bodySmall, color = TextMuted)
                Text(
                    state.workerName.ifBlank { workerName },
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text(dateFmt.format(Date()), style = MaterialTheme.typography.labelSmall, color = TextSecondary)
            }
            IconButton(
                onClick = { vm.refresh(serverUrl, workerName) },
                modifier = Modifier.size(40.dp).background(BgCard, CircleShape),
            ) {
                Icon(Icons.Outlined.Refresh, null, tint = TextSecondary, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(Modifier.height(20.dp))

        if (state.loading && state.today == null && state.week.isEmpty()) {
            Box(Modifier.fillMaxWidth().height(260.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }
        } else {
            // ── Hero check-in card
            HeroStatusCard(state.today, tick, modifier = Modifier.padding(horizontal = 20.dp))

            Spacer(Modifier.height(14.dp))

            // ── Stat row
            StatRow(state.today, tick, modifier = Modifier.padding(horizontal = 20.dp))

            Spacer(Modifier.height(20.dp))

            // ── 7-day week bar chart
            WeekSection(state.week, modifier = Modifier.padding(horizontal = 20.dp))

            // ── Error
            if (state.error.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
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

            Spacer(Modifier.height(24.dp))
        }
    }
}

// ─── Hero card: prominent today status ───────────────────────────────────────

@Composable
private fun HeroStatusCard(today: AttendanceRecord?, tick: Long, modifier: Modifier = Modifier) {
    val isIn      = today?.status == "partial"
    val isDone    = today?.status == "present"
    val isAbsent  = today == null || today.status == "absent"

    val gradientColors = when {
        isDone   -> listOf(AccentBlue.copy(0.25f), BgCard)
        isIn     -> listOf(GreenSuccess.copy(0.2f), BgCard)
        else     -> listOf(BgCard, BgElevated)
    }
    val accentColor = when {
        isDone  -> AccentBlue
        isIn    -> GreenSuccess
        else    -> TextMuted
    }
    val icon = when {
        isDone  -> Icons.Outlined.CheckCircleOutline
        isIn    -> Icons.Outlined.Login
        else    -> Icons.Outlined.HourglassEmpty
    }
    val statusText = when {
        isDone  -> "Day Complete"
        isIn    -> "Checked In"
        else    -> "Not Checked In"
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.verticalGradient(gradientColors))
            .border(1.dp, accentColor.copy(0.25f), RoundedCornerShape(20.dp))
            .padding(24.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Status badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(accentColor.copy(0.12f))
                    .padding(horizontal = 12.dp, vertical = 5.dp),
            ) {
                Icon(icon, null, tint = accentColor, modifier = Modifier.size(14.dp))
                Text(statusText, style = MaterialTheme.typography.labelMedium, color = accentColor, fontWeight = FontWeight.SemiBold)
            }

            // Big time display
            if (today?.checkIn != null) {
                Text(
                    timeFmt.format(Date(today.checkIn)),
                    style = MaterialTheme.typography.displaySmall.copy(fontSize = 52.sp, letterSpacing = (-1).sp),
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text("Check-in time", style = MaterialTheme.typography.labelSmall, color = TextSecondary)

                if (isIn) {
                    val elapsedMin = (tick - today.checkIn) / 60_000L
                    Spacer(Modifier.height(4.dp))
                    ElapsedBar(elapsedMin)
                }
            } else {
                // No scan yet — show dashes
                Text(
                    "- - : - -",
                    style = MaterialTheme.typography.displaySmall.copy(fontSize = 52.sp, letterSpacing = (-1).sp),
                    color = TextMuted,
                    fontWeight = FontWeight.Light,
                )
                Text("Waiting for NFC scan…", style = MaterialTheme.typography.labelSmall, color = TextMuted)
            }
        }
    }
}

@Composable
private fun ElapsedBar(elapsedMin: Long) {
    val h = elapsedMin / 60
    val m = elapsedMin % 60
    val targetMins = 480f // 8h target
    val pct = (elapsedMin / targetMins).coerceIn(0f, 1f)

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Outlined.Timer, null, tint = OrangeWarning, modifier = Modifier.size(13.dp))
            Text("${h}h ${m}m working", style = MaterialTheme.typography.labelMedium, color = OrangeWarning)
        }
        // Progress toward 8h
        Box(
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(BorderSubtle),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(pct)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(2.dp))
                    .background(Brush.horizontalGradient(listOf(GreenSuccess, OrangeWarning))),
            )
        }
        Text("${(pct * 100).toInt()}% of 8h shift", style = MaterialTheme.typography.labelSmall, color = TextMuted)
    }
}

// ─── Stat mini-cards ─────────────────────────────────────────────────────────

@Composable
private fun StatRow(today: AttendanceRecord?, tick: Long, modifier: Modifier = Modifier) {
    val hasCheckIn  = today?.checkIn != null
    val hasCheckOut = today?.checkOut != null

    if (!hasCheckIn && !hasCheckOut) return

    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (hasCheckIn) {
            MiniStat(
                icon   = Icons.Outlined.Login,
                label  = "Check In",
                value  = timeFmt.format(Date(today!!.checkIn!!)),
                color  = GreenSuccess,
                modifier = Modifier.weight(1f),
            )
        }
        when {
            hasCheckOut -> MiniStat(
                icon   = Icons.Outlined.Logout,
                label  = "Check Out",
                value  = timeFmt.format(Date(today!!.checkOut!!)),
                color  = AccentBlue,
                modifier = Modifier.weight(1f),
            )
            hasCheckIn -> {
                val elapsed = (tick - today!!.checkIn!!) / 60_000L
                MiniStat(
                    icon   = Icons.Outlined.Schedule,
                    label  = "Duration",
                    value  = "${elapsed / 60}h ${elapsed % 60}m",
                    color  = OrangeWarning,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (hasCheckOut && today?.totalMinutes != null) {
            MiniStat(
                icon   = Icons.Outlined.BarChart,
                label  = "Total",
                value  = "${today.totalMinutes / 60}h ${today.totalMinutes % 60}m",
                color  = AccentPurple,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MiniStat(icon: ImageVector, label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(BgCard)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(15.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
    }
}

// ─── 7-day bar chart ─────────────────────────────────────────────────────────

@Composable
private fun WeekSection(week: List<AttendanceRecord>, modifier: Modifier = Modifier) {
    if (week.isEmpty()) return
    val todayStr = parseFmt.format(Date())
    val maxMin   = week.maxOfOrNull { it.totalMinutes ?: 0 }.takeIf { it != null && it > 0 } ?: 480

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Last 7 Days", style = MaterialTheme.typography.titleSmall, color = TextPrimary, fontWeight = FontWeight.SemiBold)
            val total = week.sumOf { it.totalMinutes ?: 0 }
            Text("${total / 60}h ${total % 60}m", style = MaterialTheme.typography.labelSmall, color = TextMuted)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(BgCard)
                .border(1.dp, BorderSubtle, RoundedCornerShape(14.dp))
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            week.forEach { rec ->
                val isToday = rec.date == todayStr
                val pct = ((rec.totalMinutes ?: 0).toFloat() / maxMin).coerceIn(0f, 1f)
                val barColor = when {
                    rec.status == "present"             -> AccentPurple
                    isToday && rec.status == "partial"  -> OrangeWarning
                    rec.status == "partial"             -> OrangeWarning
                    else                                -> BorderSubtle
                }
                val dayLabel = try {
                    dayFmt.format(parseFmt.parse(rec.date)!!).take(2)
                } catch (_: Exception) { "??" }
                val mins = rec.totalMinutes ?: 0

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    // Hours label on top if present
                    if (mins > 0) {
                        Text(
                            "${mins / 60}h",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                            color = barColor,
                        )
                    } else {
                        Spacer(Modifier.height(14.dp))
                    }

                    // Bar
                    Box(
                        modifier = Modifier.fillMaxWidth().height(70.dp).clip(RoundedCornerShape(5.dp)).background(BgElevated),
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        if (pct > 0f) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .fillMaxHeight(pct.coerceAtLeast(0.06f))
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(
                                        if (isToday)
                                            Brush.verticalGradient(listOf(barColor, barColor.copy(0.5f)))
                                        else
                                            Brush.verticalGradient(listOf(barColor.copy(0.65f), barColor.copy(0.25f)))
                                    ),
                            )
                        }
                    }

                    // Day label
                    Text(
                        dayLabel,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                        color = if (isToday) AccentPurple else TextMuted,
                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                    )

                    // Today dot
                    if (isToday) {
                        Box(Modifier.size(4.dp).background(AccentPurple, CircleShape))
                    }
                }
            }
        }
    }
}

private fun greeting(): String {
    val h = Calendar.getInstance(TZ_UTC3).get(Calendar.HOUR_OF_DAY)
    return when {
        h < 12 -> "Good morning,"
        h < 17 -> "Good afternoon,"
        else   -> "Good evening,"
    }
}
