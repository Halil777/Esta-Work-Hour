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
import com.workhour.worker.data.model.SavedUser
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
fun HomeScreen(serverUrl: String, user: SavedUser) {
    val c   = LocalAppColors.current
    val vm: HomeViewModel = viewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    // Live clock — ticks every second for elapsed display
    var tick by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) { delay(1_000L); tick = System.currentTimeMillis() }
    }

    LaunchedEffect(serverUrl) { vm.load(serverUrl, user.workerEntityId, user.name) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgDeep)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Top bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 20.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(greeting(), style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                Text(
                    state.workerName.ifBlank { user.name },
                    style = MaterialTheme.typography.titleLarge,
                    color = c.textPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text(dateFmt.format(Date()), style = MaterialTheme.typography.labelSmall, color = c.textSecondary)
            }
            IconButton(
                onClick = { vm.refresh(serverUrl, user.workerEntityId, user.name) },
                modifier = Modifier.size(40.dp).background(c.bgCard, CircleShape),
            ) {
                Icon(Icons.Outlined.Refresh, null, tint = c.textSecondary, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(Modifier.height(20.dp))

        if (state.loading && state.today == null && state.week.isEmpty()) {
            Box(Modifier.fillMaxWidth().height(260.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }
        } else {
            HeroStatusCard(state.today, tick, c, modifier = Modifier.padding(horizontal = 20.dp))
            Spacer(Modifier.height(14.dp))
            StatRow(state.today, tick, c, modifier = Modifier.padding(horizontal = 20.dp))
            Spacer(Modifier.height(20.dp))
            WeekSection(state.week, c, modifier = Modifier.padding(horizontal = 20.dp))

            if (state.error.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier
                        .padding(horizontal = 20.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(c.redDim.copy(0.3f))
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

// ─── Hero card ────────────────────────────────────────────────────────────────

@Composable
private fun HeroStatusCard(today: AttendanceRecord?, tick: Long, c: AppColors, modifier: Modifier = Modifier) {
    val isIn     = today?.status == "partial"
    val isDone   = today?.status == "present"

    val gradientColors = when {
        isDone -> listOf(AccentBlue.copy(0.25f), c.bgCard)
        isIn   -> listOf(GreenSuccess.copy(0.2f), c.bgCard)
        else   -> listOf(c.bgCard, c.bgElevated)
    }
    val accentColor = when {
        isDone -> AccentBlue
        isIn   -> GreenSuccess
        else   -> c.textMuted
    }
    val icon = when {
        isDone -> Icons.Outlined.CheckCircleOutline
        isIn   -> Icons.Outlined.Login
        else   -> Icons.Outlined.HourglassEmpty
    }
    val statusText = when {
        isDone -> "Day Complete"
        isIn   -> "Checked In"
        else   -> "Not Checked In"
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

            if (today?.checkIn != null) {
                Text(
                    timeFmt.format(Date(today.checkIn)),
                    style = MaterialTheme.typography.displaySmall.copy(fontSize = 52.sp, letterSpacing = (-1).sp),
                    color = c.textPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text("Check-in time", style = MaterialTheme.typography.labelSmall, color = c.textSecondary)

                if (isIn) {
                    Spacer(Modifier.height(4.dp))
                    ElapsedBar(today.checkIn, tick, c)
                }
            } else {
                Text(
                    "- - : - -",
                    style = MaterialTheme.typography.displaySmall.copy(fontSize = 52.sp, letterSpacing = (-1).sp),
                    color = c.textMuted,
                    fontWeight = FontWeight.Light,
                )
                Text("Waiting for NFC scan…", style = MaterialTheme.typography.labelSmall, color = c.textMuted)
            }
        }
    }
}

@Composable
private fun ElapsedBar(checkInMs: Long, tick: Long, c: AppColors) {
    val elapsedMs  = tick - checkInMs
    val h          = elapsedMs / 3_600_000L
    val m          = (elapsedMs % 3_600_000L) / 60_000L
    val s          = (elapsedMs % 60_000L) / 1_000L
    val elapsedMin = elapsedMs / 60_000L
    val targetPct  = (elapsedMin / 480f).coerceIn(0f, 1f)
    val animPct by animateFloatAsState(targetPct, tween(1000, easing = EaseOutCubic), label = "elapsed")

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Outlined.Timer, null, tint = OrangeWarning, modifier = Modifier.size(13.dp))
            Text(
                "%02d:%02d:%02d working".format(h, m, s),
                style = MaterialTheme.typography.labelMedium,
                color = OrangeWarning,
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(c.borderSubtle),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animPct)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(2.dp))
                    .background(Brush.horizontalGradient(listOf(GreenSuccess, OrangeWarning))),
            )
        }
        Text("${(animPct * 100).toInt()}% of 8h shift", style = MaterialTheme.typography.labelSmall, color = c.textMuted)
    }
}

// ─── Stat mini-cards ──────────────────────────────────────────────────────────

@Composable
private fun StatRow(today: AttendanceRecord?, tick: Long, c: AppColors, modifier: Modifier = Modifier) {
    val hasCheckIn  = today?.checkIn != null
    val hasCheckOut = today?.checkOut != null
    if (!hasCheckIn && !hasCheckOut) return

    // Animate duration minutes
    val rawMin = if (hasCheckIn && !hasCheckOut)
        ((tick - today!!.checkIn!!) / 60_000L).toInt()
    else today?.totalMinutes ?: 0
    val animMin by animateIntAsState(rawMin, tween(800, easing = EaseOutCubic), label = "min")

    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (hasCheckIn) {
            MiniStat(
                icon   = Icons.Outlined.Login,
                label  = "Check In",
                value  = timeFmt.format(Date(today!!.checkIn!!)),
                color  = GreenSuccess,
                c      = c,
                modifier = Modifier.weight(1f),
            )
        }
        when {
            hasCheckOut -> MiniStat(
                icon   = Icons.Outlined.Logout,
                label  = "Check Out",
                value  = timeFmt.format(Date(today!!.checkOut!!)),
                color  = AccentBlue,
                c      = c,
                modifier = Modifier.weight(1f),
            )
            hasCheckIn -> {
                val h = animMin / 60
                val m = animMin % 60
                MiniStat(
                    icon   = Icons.Outlined.Schedule,
                    label  = "Duration",
                    value  = "%dh %02dm".format(h, m),
                    color  = OrangeWarning,
                    c      = c,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (hasCheckOut && today?.totalMinutes != null) {
            val h = animMin / 60
            val m = animMin % 60
            MiniStat(
                icon   = Icons.Outlined.BarChart,
                label  = "Total",
                value  = "%dh %02dm".format(h, m),
                color  = AccentPurple,
                c      = c,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MiniStat(icon: ImageVector, label: String, value: String, color: Color, c: AppColors, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(c.bgCard)
            .border(1.dp, c.borderSubtle, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(15.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, color = c.textPrimary, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = c.textSecondary)
    }
}

// ─── 7-day bar chart ──────────────────────────────────────────────────────────

@Composable
private fun WeekSection(week: List<AttendanceRecord>, c: AppColors, modifier: Modifier = Modifier) {
    if (week.isEmpty()) return
    val todayStr = parseFmt.format(Date())
    val maxMin   = week.maxOfOrNull { it.totalMinutes ?: 0 }.takeIf { it != null && it > 0 } ?: 480

    // Animate total
    val totalRaw = week.sumOf { it.totalMinutes ?: 0 }
    val animTotal by animateIntAsState(totalRaw, tween(800, easing = EaseOutCubic), label = "total")

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Last 7 Days", style = MaterialTheme.typography.titleSmall, color = c.textPrimary, fontWeight = FontWeight.SemiBold)
            Text("${animTotal / 60}h ${animTotal % 60}m", style = MaterialTheme.typography.labelSmall, color = c.textMuted)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(c.bgCard)
                .border(1.dp, c.borderSubtle, RoundedCornerShape(14.dp))
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            week.forEach { rec ->
                val isToday  = rec.date == todayStr
                val targetPct = ((rec.totalMinutes ?: 0).toFloat() / maxMin).coerceIn(0f, 1f)
                val animPct by animateFloatAsState(targetPct, tween(700, easing = EaseOutCubic), label = "bar")
                val barColor = when {
                    rec.status == "present"            -> AccentPurple
                    rec.status == "partial"            -> OrangeWarning
                    else                               -> c.borderSubtle
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
                    if (mins > 0) {
                        Text("${mins / 60}h", style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = barColor)
                    } else {
                        Spacer(Modifier.height(14.dp))
                    }
                    Box(
                        modifier = Modifier.fillMaxWidth().height(70.dp).clip(RoundedCornerShape(5.dp)).background(c.bgElevated),
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        if (animPct > 0f) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .fillMaxHeight(animPct.coerceAtLeast(0.06f))
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
                    Text(
                        dayLabel,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                        color = if (isToday) AccentPurple else c.textMuted,
                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                    )
                    if (isToday) Box(Modifier.size(4.dp).background(AccentPurple, CircleShape))
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
