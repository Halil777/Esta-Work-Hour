package com.workhour.worker.ui.timeline

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.data.model.ScanEvent
import com.workhour.worker.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val TZ_UTC3  = TimeZone.getTimeZone("GMT+3")
private val timeFmt  = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = TZ_UTC3 }
private val secsFmt  = SimpleDateFormat("HH:mm:ss", Locale.US).apply { timeZone = TZ_UTC3 }
private val dateFmt  = SimpleDateFormat("EEEE, MMMM d", Locale.US)

@Composable
fun TimelineScreen(serverUrl: String, workerEntityId: String) {
    val s  = LocalStrings.current
    val c  = LocalAppColors.current
    val vm: TimelineViewModel = viewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(serverUrl) { vm.load(serverUrl, workerEntityId) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgDeep),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 16.dp, top = 20.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(s.todaysScans, style = MaterialTheme.typography.titleLarge, color = c.textPrimary, fontWeight = FontWeight.Bold)
                Text(dateFmt.format(Date()), style = MaterialTheme.typography.labelSmall, color = c.textSecondary)
            }
            IconButton(
                onClick = { vm.refresh(serverUrl, workerEntityId) },
                modifier = Modifier.size(40.dp).background(c.bgCard, CircleShape),
            ) {
                Icon(Icons.Outlined.Refresh, null, tint = c.textSecondary, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(Modifier.height(14.dp))

        when {
            state.loading -> Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }

            state.error.isNotEmpty() -> Box(
                Modifier.fillMaxWidth().weight(1f).padding(32.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Outlined.CloudOff, null, tint = c.textMuted, modifier = Modifier.size(40.dp))
                    Text(state.error, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                    TextButton(onClick = { vm.refresh(serverUrl, workerEntityId) }) {
                        Text("Retry", color = AccentPurple)
                    }
                }
            }

            else -> Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                SummaryCard(state.events, c, modifier = Modifier.padding(horizontal = 20.dp))
                Spacer(Modifier.height(20.dp))
                if (state.events.isEmpty()) {
                    EmptyTimeline(s, c, modifier = Modifier.padding(horizontal = 20.dp))
                } else {
                    Timeline(state.events, s, c, modifier = Modifier.padding(horizontal = 20.dp))
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun SummaryCard(events: List<ScanEvent>, c: AppColors, modifier: Modifier = Modifier) {
    val s         = LocalStrings.current
    val checkIns  = events.count { it.eventType == "CHECK_IN" }
    val checkOuts = events.count { it.eventType == "CHECK_OUT" }
    val lastEvent = events.lastOrNull()
    val isIn      = lastEvent?.eventType == "CHECK_IN"

    val (statusColor, statusLabel, statusIcon) = when {
        events.isEmpty() -> Triple(c.textMuted, s.noScansToday, Icons.Outlined.HourglassEmpty)
        isIn             -> Triple(GreenSuccess, s.currentlyWorking, Icons.Outlined.Login)
        else             -> Triple(AccentBlue, s.checkedOut, Icons.Outlined.CheckCircleOutline)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(statusColor.copy(0.15f), c.bgCard)))
            .border(1.dp, statusColor.copy(0.25f), RoundedCornerShape(14.dp))
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier.size(46.dp).clip(RoundedCornerShape(12.dp)).background(statusColor.copy(0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(statusIcon, null, tint = statusColor, modifier = Modifier.size(22.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(statusLabel, style = MaterialTheme.typography.titleSmall, color = statusColor, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("$checkIns check-in${if (checkIns != 1) "s" else ""}", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                    Text("$checkOuts check-out${if (checkOuts != 1) "s" else ""}", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun Timeline(events: List<ScanEvent>, s: AppStrings, c: AppColors, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth()) {
        events.forEachIndexed { index, event ->
            val isLast    = index == events.lastIndex
            val isCheckIn = event.eventType == "CHECK_IN"
            val nodeColor = if (isCheckIn) GreenSuccess else AccentBlue
            val nextEvent = events.getOrNull(index + 1)

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(32.dp)) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(nodeColor.copy(0.15f))
                            .border(2.dp, nodeColor, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (isCheckIn) Icons.Outlined.Login else Icons.Outlined.Logout,
                            null,
                            tint = nodeColor,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                    if (!isLast) {
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(72.dp)
                                .background(Brush.verticalGradient(listOf(nodeColor.copy(0.4f), c.borderSubtle.copy(0.3f)))),
                        )
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    EventCard(event, nodeColor, c)
                    if (!isLast && nextEvent != null) {
                        val gapMs  = nextEvent.eventTime - event.eventTime
                        val gapMin = gapMs / 60_000L
                        GapLabel(
                            gapMin    = gapMin,
                            isBreak   = !isCheckIn && nextEvent.eventType == "CHECK_IN",
                            isWorking = isCheckIn && nextEvent.eventType == "CHECK_OUT",
                            s         = s,
                            c         = c,
                            modifier  = Modifier.padding(top = 8.dp, bottom = 8.dp, start = 4.dp),
                        )
                    }
                }
            }
        }

        // Pending tail (last event is CHECK_IN)
        if (events.isNotEmpty() && events.last().eventType == "CHECK_IN") {
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(32.dp)) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(c.borderSubtle.copy(0.3f))
                            .border(2.dp, c.borderSubtle, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.QuestionMark, null, tint = c.textMuted, modifier = Modifier.size(14.dp))
                    }
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(c.bgCard)
                        .border(1.dp, c.borderSubtle, RoundedCornerShape(10.dp))
                        .padding(12.dp),
                ) {
                    Text(s.waitingCheckOut, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
                }
            }
        }
    }
}

@Composable
private fun EventCard(event: ScanEvent, nodeColor: Color, c: AppColors) {
    val isCheckIn = event.eventType == "CHECK_IN"
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(c.bgCard)
            .border(1.dp, nodeColor.copy(0.2f), RoundedCornerShape(12.dp))
            .padding(14.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    if (isCheckIn) "CHECK IN" else "CHECK OUT",
                    style = MaterialTheme.typography.labelMedium,
                    color = nodeColor,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                )
                Text(event.source ?: "NFC", style = MaterialTheme.typography.labelSmall, color = c.textMuted)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    timeFmt.format(Date(event.eventTime)),
                    style = MaterialTheme.typography.titleMedium.copy(fontSize = 20.sp),
                    color = c.textPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    secsFmt.format(Date(event.eventTime)),
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                    color = c.textMuted,
                )
            }
        }
    }
}

@Composable
private fun GapLabel(gapMin: Long, isBreak: Boolean, isWorking: Boolean, s: AppStrings, c: AppColors, modifier: Modifier = Modifier) {
    val h = gapMin / 60
    val m = gapMin % 60
    val durationText = if (h > 0) "${h}h ${m}m" else "${m}m"
    val (label, color) = when {
        isWorking -> (s.workingFor + " $durationText") to GreenSuccess
        isBreak   -> (s.break_ + " — $durationText")  to OrangeWarning
        else      -> "$durationText" to c.textMuted
    }
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            if (isWorking) Icons.Outlined.Timer else Icons.Outlined.Coffee,
            null, tint = color, modifier = Modifier.size(11.dp),
        )
        Text(label, style = MaterialTheme.typography.labelSmall, color = color)
    }
}

@Composable
private fun EmptyTimeline(s: AppStrings, c: AppColors, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(c.bgCard)
            .border(1.dp, c.borderSubtle, RoundedCornerShape(14.dp))
            .padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier.size(64.dp).clip(CircleShape).background(c.bgElevated),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Outlined.RadioButtonUnchecked, null, tint = c.textMuted, modifier = Modifier.size(32.dp))
        }
        Text(s.noScansToday, style = MaterialTheme.typography.titleSmall, color = c.textPrimary)
        Text(s.noScansDesc, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
    }
}
