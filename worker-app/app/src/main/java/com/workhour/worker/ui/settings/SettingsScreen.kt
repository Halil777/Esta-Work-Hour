package com.workhour.worker.ui.settings

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.workhour.worker.ui.AppViewModel
import com.workhour.worker.ui.theme.*

@Composable
fun SettingsScreen(serverUrl: String) {
    val appVm    : AppViewModel      = viewModel()
    val settingsVm: SettingsViewModel = viewModel()

    val s        = LocalStrings.current
    val c        = LocalAppColors.current
    val language by appVm.language.collectAsStateWithLifecycle()
    val theme    by appVm.theme.collectAsStateWithLifecycle()
    val pwState  by settingsVm.pwState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgDeep)
            .verticalScroll(rememberScrollState()),
    ) {
        Text(
            s.settings,
            style = MaterialTheme.typography.titleLarge,
            color = c.textPrimary,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp, bottom = 20.dp),
        )

        // ── Appearance: Language + Theme
        SettingsSection(s.appearance, Icons.Outlined.Palette, c) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // Language
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(s.language, style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        AppLanguage.entries.forEach { lang ->
                            val selected = language == lang
                            FilterChip(
                                selected = selected,
                                onClick  = { appVm.setLanguage(lang) },
                                label    = {
                                    Text(
                                        "${lang.flag}  ${lang.displayName}",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    )
                                },
                                modifier = Modifier.weight(1f),
                                colors   = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AccentPurple,
                                    selectedLabelColor     = androidx.compose.ui.graphics.Color.White,
                                    containerColor         = c.bgElevated,
                                    labelColor             = c.textSecondary,
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled             = true,
                                    selected            = selected,
                                    borderColor         = c.borderSubtle,
                                    selectedBorderColor = AccentPurple,
                                ),
                            )
                        }
                    }
                }

                HorizontalDivider(color = c.borderSubtle)

                // Theme
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(s.theme, style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        AppTheme.entries.forEach { t ->
                            val selected = theme == t
                            val label    = if (t == AppTheme.DARK) s.darkMode else s.lightMode
                            val icon     = if (t == AppTheme.DARK) "🌙" else "☀️"
                            FilterChip(
                                selected = selected,
                                onClick  = { appVm.setTheme(t) },
                                label    = {
                                    Text(
                                        "$icon  $label",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                    )
                                },
                                modifier = Modifier.weight(1f),
                                colors   = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AccentPurple,
                                    selectedLabelColor     = androidx.compose.ui.graphics.Color.White,
                                    containerColor         = c.bgElevated,
                                    labelColor             = c.textSecondary,
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled             = true,
                                    selected            = selected,
                                    borderColor         = c.borderSubtle,
                                    selectedBorderColor = AccentPurple,
                                ),
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // ── Security: Change Password
        SettingsSection(s.security, Icons.Outlined.Security, c) {
            ChangePasswordForm(
                serverUrl        = serverUrl,
                pwState          = pwState,
                strings          = s,
                c                = c,
                onSubmit         = { cur, new_, conf ->
                    settingsVm.changePassword(serverUrl, cur, new_, conf, errMismatch = s.passwordsDoNotMatch, errShort = s.passwordTooShort)
                },
                onDismissSuccess = { settingsVm.clearPasswordState() },
            )
        }

        Spacer(Modifier.height(12.dp))

        // ── About
        SettingsSection(s.about, Icons.Outlined.Info, c) {
            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("WorkHour Worker", style = MaterialTheme.typography.bodyMedium, color = c.textPrimary)
                Text(s.appVersion, style = MaterialTheme.typography.bodySmall, color = c.textMuted)
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ChangePasswordForm(
    serverUrl: String,
    pwState: PasswordState,
    strings: AppStrings,
    c: AppColors,
    onSubmit: (current: String, new_: String, confirm: String) -> Unit,
    onDismissSuccess: () -> Unit,
) {
    val focus = LocalFocusManager.current
    var current   by remember { mutableStateOf("") }
    var new_      by remember { mutableStateOf("") }
    var confirm   by remember { mutableStateOf("") }
    var showCur   by remember { mutableStateOf(false) }
    var showNew   by remember { mutableStateOf(false) }
    var showConf  by remember { mutableStateOf(false) }

    LaunchedEffect(pwState.success) {
        if (pwState.success) { current = ""; new_ = ""; confirm = "" }
    }

    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AnimatedVisibility(visible = pwState.success) {
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.greenDim.copy(0.4f))
                    .clickable { onDismissSuccess() }.padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.CheckCircleOutline, null, tint = GreenSuccess, modifier = Modifier.size(16.dp))
                Text(strings.passwordChanged, style = MaterialTheme.typography.bodySmall, color = GreenSuccess, modifier = Modifier.weight(1f))
                Icon(Icons.Outlined.Close, null, tint = GreenSuccess.copy(0.6f), modifier = Modifier.size(14.dp))
            }
        }
        AnimatedVisibility(visible = pwState.error.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.redDim.copy(0.4f)).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = RedDanger, modifier = Modifier.size(16.dp))
                Text(pwState.error, style = MaterialTheme.typography.bodySmall, color = RedDanger)
            }
        }

        PasswordField(current, { current = it }, strings.currentPassword, showCur, { showCur = !showCur }, ImeAction.Next, { focus.moveFocus(FocusDirection.Down) }, c)
        PasswordField(new_,    { new_ = it },    strings.newPassword,     showNew, { showNew = !showNew }, ImeAction.Next, { focus.moveFocus(FocusDirection.Down) }, c)
        PasswordField(confirm, { confirm = it }, strings.confirmPassword,  showConf,{ showConf = !showConf }, ImeAction.Done,
            { focus.clearFocus(); onSubmit(current, new_, confirm) }, c, confirm.isNotEmpty() && new_ != confirm)

        Button(
            onClick  = { focus.clearFocus(); onSubmit(current, new_, confirm) },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled  = !pwState.loading && current.isNotBlank() && new_.isNotBlank() && confirm.isNotBlank(),
            shape    = RoundedCornerShape(12.dp),
            colors   = ButtonDefaults.buttonColors(containerColor = AccentPurple),
        ) {
            if (pwState.loading) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = androidx.compose.ui.graphics.Color.White, strokeWidth = 2.dp)
            } else {
                Icon(Icons.Outlined.Lock, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(strings.updatePassword, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun PasswordField(
    value: String, onChange: (String) -> Unit, label: String,
    visible: Boolean, onToggle: () -> Unit,
    imeAction: ImeAction, onImeAction: () -> Unit, c: AppColors, isError: Boolean = false,
) {
    OutlinedTextField(
        value = value, onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(), label = { Text(label) },
        leadingIcon  = { Icon(Icons.Outlined.Lock, null, tint = c.textSecondary) },
        trailingIcon = {
            IconButton(onClick = onToggle) {
                Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null, tint = c.textSecondary)
            }
        },
        singleLine = true, isError = isError,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(onNext = { onImeAction() }, onDone = { onImeAction() }),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor      = AccentPurple, unfocusedBorderColor    = c.borderSubtle,
            focusedLabelColor       = AccentPurple, unfocusedLabelColor     = c.textSecondary,
            focusedTextColor        = c.textPrimary, unfocusedTextColor     = c.textPrimary,
            cursorColor             = AccentPurple,
            unfocusedContainerColor = c.bgElevated, focusedContainerColor   = c.bgElevated,
            focusedLeadingIconColor = AccentPurple,
        ),
    )
}

@Composable
private fun SettingsSection(title: String, icon: ImageVector, c: AppColors, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(bottom = 8.dp, start = 2.dp),
        ) {
            Icon(icon, null, tint = AccentPurple, modifier = Modifier.size(14.dp))
            Text(title, style = MaterialTheme.typography.labelMedium, color = c.textMuted, fontWeight = FontWeight.SemiBold)
        }
        Column(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.bgCard).border(1.dp, c.borderSubtle, RoundedCornerShape(14.dp)),
            content  = content,
        )
    }
}
