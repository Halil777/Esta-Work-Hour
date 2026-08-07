package com.workhour.worker.ui.profile

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.data.model.WorkerProfile
import com.workhour.worker.data.network.ApiClient
import com.workhour.worker.ui.theme.*

@Composable
fun ProfileScreen(serverUrl: String, user: SavedUser, onLogout: () -> Unit) {
    val s = LocalStrings.current
    var profile          by remember { mutableStateOf<WorkerProfile?>(null) }
    var loading          by remember { mutableStateOf(true) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(serverUrl) {
        loading = true
        try { profile = ApiClient.get(serverUrl).getMyProfile() } catch (_: Exception) {}
        loading = false
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title   = { Text(s.signOutConfirmTitle, color = TextPrimary) },
            text    = { Text(s.signOutConfirmText, color = TextSecondary) },
            confirmButton = {
                TextButton(onClick = { showLogoutDialog = false; onLogout() }) {
                    Text(s.signOut, color = RedDanger, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text(s.cancel, color = TextSecondary)
                }
            },
            containerColor = BgCard,
            shape = RoundedCornerShape(16.dp),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDeep)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        // ── Header gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(AccentPurpleDim.copy(0.3f), BgDeep)))
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
                    Text(
                        user.name.initials(),
                        style = MaterialTheme.typography.headlineMedium.copy(fontSize = 28.sp),
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(user.name, style = MaterialTheme.typography.titleLarge, color = TextPrimary)
                    Text(profile?.workerId ?: "…", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        if (loading) {
            Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AccentPurple, strokeWidth = 2.dp)
            }
        } else {
            Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionTitle(s.workDetails)
                InfoCard {
                    profile?.let { p ->
                        ProfileRow(Icons.Outlined.Badge,        s.workerId,    p.workerId)
                        HRule()
                        ProfileRow(Icons.Outlined.Work,         s.profession,  p.profession ?: "—")
                        HRule()
                        ProfileRow(Icons.Outlined.Groups,       s.brigade,     p.brigadeName ?: "—")
                        HRule()
                        ProfileRow(Icons.Outlined.LightMode,    s.shift,       p.shift?.let { if (it == "day") s.day else s.night } ?: "—")
                        HRule()
                        ProfileRow(Icons.Outlined.Schedule,     s.workSystem,  p.mesaiSistemi ?: "—")
                        HRule()
                        ProfileRow(Icons.Outlined.VerifiedUser, s.status,      p.status)
                    } ?: Text(s.noData, color = TextMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(14.dp))
                }

                Spacer(Modifier.height(8.dp))
                SectionTitle(s.account)
                InfoCard {
                    ProfileRow(Icons.Outlined.ManageAccounts, s.role,   user.role.replaceFirstChar { it.uppercase() })
                    HRule()
                    ProfileRow(Icons.Outlined.Cloud,          s.server, serverUrl)
                }

                Spacer(Modifier.height(20.dp))

                Button(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RedDim.copy(0.6f)),
                ) {
                    Icon(Icons.Outlined.Logout, null, tint = RedDanger, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(s.signOut, color = RedDanger, style = MaterialTheme.typography.titleSmall)
                }
            }
        }
    }
}

@Composable private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.labelMedium, color = TextMuted, modifier = Modifier.padding(horizontal = 4.dp))
}
@Composable private fun InfoCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(BgCard).border(1.dp, BorderSubtle, RoundedCornerShape(14.dp)),
        content = content,
    )
}
@Composable private fun ProfileRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = AccentPurple, modifier = Modifier.size(16.dp))
            Text(label, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        }
        Text(value, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.Medium)
    }
}
@Composable private fun HRule() {
    HorizontalDivider(color = BorderSubtle, thickness = 0.5.dp, modifier = Modifier.padding(horizontal = 14.dp))
}
private fun String.initials() =
    trim().split(" ").mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }.take(2).joinToString("").ifBlank { "?" }
