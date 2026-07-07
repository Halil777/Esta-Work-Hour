package com.esta.workforce.ui.settings

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.esta.workforce.data.model.AppTheme
import com.esta.workforce.data.model.Language
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.theme.*

@Composable
fun SettingsScreen(appVm: AppViewModel, onLogout: () -> Unit) {
    val user by appVm.user.collectAsState()
    val language by appVm.language.collectAsState()
    val theme by appVm.theme.collectAsState()
    val colors = LocalAppColors.current
    val strings = LocalStrings.current

    val initials = user?.name
        ?.split(" ")
        ?.filter { it.isNotEmpty() }
        ?.take(2)
        ?.joinToString("") { it.first().uppercase() }
        ?: "?"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Profile card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card),
            border = BorderStroke(1.dp, colors.border),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(shape = CircleShape, color = PrimaryLight, modifier = Modifier.size(52.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(initials, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Primary)
                    }
                }
                Column {
                    Text(user?.name ?: "", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    Text(user?.role?.name ?: "", fontSize = 13.sp, color = colors.textSecondary)
                    if (!user?.objectName.isNullOrEmpty()) {
                        Text(user?.objectName ?: "", fontSize = 12.sp, color = colors.textMuted)
                    }
                }
            }
        }

        // Theme & Language section
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card),
            border = BorderStroke(1.dp, colors.border),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(strings.settings, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Spacer(Modifier.height(14.dp))

                // Theme toggle row
                HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Theme", fontSize = 14.sp, color = colors.text)
                    Surface(
                        onClick = { appVm.toggleTheme() },
                        shape = RoundedCornerShape(99.dp),
                        color = if (theme == AppTheme.DARK) Color(0xFF1A2335) else Color(0xFFE2E8F0),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(if (theme == AppTheme.DARK) "🌙" else "☀️", fontSize = 16.sp)
                            Text(
                                if (theme == AppTheme.DARK) "Dark" else "Light",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = colors.textSecondary,
                            )
                        }
                    }
                }

                // Language selector
                HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                Column(
                    modifier = Modifier.padding(vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text("Language", fontSize = 14.sp, color = colors.text)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            Language.RU to "Русский",
                            Language.EN to "English",
                            Language.TK to "Türkmen",
                        ).forEach { (lang, label) ->
                            val active = language == lang
                            Surface(
                                onClick = { appVm.setLanguage(lang) },
                                shape = RoundedCornerShape(99.dp),
                                color = if (active) Primary else colors.card2,
                                border = BorderStroke(1.dp, if (active) Primary else colors.border),
                            ) {
                                Text(
                                    label,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (active) Color.White else colors.textSecondary,
                                )
                            }
                        }
                    }
                }
            }
        }

        // Object info section
        if (!user?.objectName.isNullOrEmpty()) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = colors.card),
                border = BorderStroke(1.dp, colors.border),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Object", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    Spacer(Modifier.height(14.dp))

                    InfoRow("Site", user?.objectName ?: "", colors = colors)
                    HorizontalDivider(color = colors.border, thickness = 0.5.dp)
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Role", fontSize = 14.sp, color = colors.textSecondary)
                        Surface(shape = RoundedCornerShape(99.dp), color = PrimaryLight) {
                            Text(
                                user?.role?.name ?: "",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Primary,
                            )
                        }
                    }
                }
            }
        }

        // Logout button
        Surface(
            onClick = { onLogout() },
            shape = RoundedCornerShape(14.dp),
            color = DangerLight,
            border = BorderStroke(1.dp, Danger),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                Text(strings.logout, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Danger)
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun InfoRow(label: String, value: String, colors: AppColors) {
    HorizontalDivider(color = colors.border, thickness = 0.5.dp)
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 14.sp, color = colors.textSecondary)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = colors.text)
    }
}
