package com.workhour.worker.ui.profile

import android.app.Application
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workhour.worker.data.local.db.AppDatabase
import com.workhour.worker.data.local.db.WorkerProfileEntity
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.data.model.WorkerProfile
import com.workhour.worker.data.network.ApiClient
import com.workhour.worker.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(serverUrl: String, user: SavedUser, onLogout: () -> Unit) {
    val s     = LocalStrings.current
    val c     = LocalAppColors.current
    val ctx   = LocalContext.current
    val scope = rememberCoroutineScope()

    var profile          by remember { mutableStateOf<WorkerProfile?>(null) }
    var loading          by remember { mutableStateOf(true) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(serverUrl) {
        loading = true
        val db = AppDatabase.get(ctx)
        // Show cached profile
        val cached = db.dao().getProfile(user.workerEntityId)
        if (cached != null) { profile = cached.toModel(); loading = false }
        // Fetch fresh
        try {
            val fresh = ApiClient.get(serverUrl).getMyProfile()
            profile = fresh
            db.dao().upsertProfile(fresh.toEntity())
        } catch (_: Exception) {}
        loading = false
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title   = { Text(s.signOutConfirmTitle, color = c.textPrimary) },
            text    = { Text(s.signOutConfirmText, color = c.textSecondary) },
            confirmButton = {
                TextButton(onClick = { showLogoutDialog = false; onLogout() }) {
                    Text(s.signOut, color = RedDanger, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text(s.cancel, color = c.textSecondary)
                }
            },
            containerColor = c.bgCard,
            shape = RoundedCornerShape(16.dp),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgDeep)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(AccentPurpleDim.copy(0.3f), c.bgDeep)))
                .padding(top = 32.dp, bottom = 28.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Brush.radialGradient(listOf(AccentPurple, AccentPurpleDim))),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(user.name.initials(), style = MaterialTheme.typography.headlineMedium.copy(fontSize = 28.sp), color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(user.name, style = MaterialTheme.typography.titleLarge, color = c.textPrimary)
                    Text(profile?.workerId ?: "…", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        if (loading && profile == null) {
            Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }
        } else {
            Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionTitle(s.workDetails, c)
                InfoCard(c) {
                    profile?.let { p ->
                        ProfileRow(Icons.Outlined.Badge,        s.workerId,   p.workerId, c)
                        HRule(c)
                        ProfileRow(Icons.Outlined.Work,         s.profession, p.profession ?: "—", c)
                        HRule(c)
                        ProfileRow(Icons.Outlined.Groups,       s.brigade,    p.brigadeName ?: "—", c)
                        HRule(c)
                        ProfileRow(Icons.Outlined.LightMode,    s.shift,      p.shift?.let { if (it == "day") s.day else s.night } ?: "—", c)
                        HRule(c)
                        ProfileRow(Icons.Outlined.Schedule,     s.workSystem, p.mesaiSistemi ?: "—", c)
                        HRule(c)
                        ProfileRow(Icons.Outlined.VerifiedUser, s.status,     p.status, c)
                    } ?: Text(s.noData, color = c.textMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(14.dp))
                }

                Spacer(Modifier.height(8.dp))
                SectionTitle(s.account, c)
                InfoCard(c) {
                    ProfileRow(Icons.Outlined.ManageAccounts, s.role,   user.role.replaceFirstChar { it.uppercase() }, c)
                    HRule(c)
                    ProfileRow(Icons.Outlined.Cloud,          s.server, serverUrl, c)
                }

                Spacer(Modifier.height(20.dp))
                Button(
                    onClick  = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape    = RoundedCornerShape(12.dp),
                    colors   = ButtonDefaults.buttonColors(containerColor = c.redDim.copy(0.6f)),
                ) {
                    Icon(Icons.Outlined.Logout, null, tint = RedDanger, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(s.signOut, color = RedDanger, style = MaterialTheme.typography.titleSmall)
                }
            }
        }
    }
}

@Composable private fun SectionTitle(text: String, c: AppColors) {
    Text(text, style = MaterialTheme.typography.labelMedium, color = c.textMuted, modifier = Modifier.padding(horizontal = 4.dp))
}
@Composable private fun InfoCard(c: AppColors, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.bgCard).border(1.dp, c.borderSubtle, RoundedCornerShape(14.dp)), content = content)
}
@Composable private fun ProfileRow(icon: ImageVector, label: String, value: String, c: AppColors) {
    Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = AccentPurple, modifier = Modifier.size(16.dp))
            Text(label, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
        Text(value, style = MaterialTheme.typography.bodySmall, color = c.textPrimary, fontWeight = FontWeight.Medium)
    }
}
@Composable private fun HRule(c: AppColors) {
    HorizontalDivider(color = c.borderSubtle, thickness = 0.5.dp, modifier = Modifier.padding(horizontal = 14.dp))
}
private fun String.initials() =
    trim().split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }.take(2).joinToString("").ifBlank { "?" }

private fun WorkerProfileEntity.toModel() = WorkerProfile(id, workerId, name, profession, brigadeName, shift, mesaiSistemi, status, mobileRole)
private fun WorkerProfile.toEntity()      = WorkerProfileEntity(id, workerId, name, profession, brigadeName, shift, mesaiSistemi, status, mobileRole)
