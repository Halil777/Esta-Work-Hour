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
    val appVm: AppViewModel = viewModel()
    val settingsVm: SettingsViewModel = viewModel()

    val s = LocalStrings.current
    val language by appVm.language.collectAsStateWithLifecycle()
    val pwState  by settingsVm.pwState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgDeep)
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Title
        Text(
            s.settings,
            style = MaterialTheme.typography.titleLarge,
            color = TextPrimary,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp, bottom = 20.dp),
        )

        // ── Language section
        SettingsSection(title = s.appearance, icon = Icons.Outlined.Palette) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(s.language, style = MaterialTheme.typography.labelMedium, color = TextSecondary)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    AppLanguage.entries.forEach { lang ->
                        val selected = language == lang
                        FilterChip(
                            selected = selected,
                            onClick  = { appVm.setLanguage(lang) },
                            label    = {
                                Text(
                                    lang.displayName,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                )
                            },
                            modifier = Modifier.weight(1f),
                            colors   = FilterChipDefaults.filterChipColors(
                                selectedContainerColor      = AccentPurple,
                                selectedLabelColor          = TextPrimary,
                                containerColor              = BgElevated,
                                labelColor                  = TextSecondary,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled                    = true,
                                selected                   = selected,
                                borderColor                = BorderSubtle,
                                selectedBorderColor        = AccentPurple,
                            ),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // ── Change Password section
        SettingsSection(title = s.security, icon = Icons.Outlined.Security) {
            ChangePasswordForm(
                serverUrl  = serverUrl,
                pwState    = pwState,
                strings    = s,
                onSubmit   = { cur, new_, conf ->
                    settingsVm.changePassword(
                        serverUrl   = serverUrl,
                        current     = cur,
                        new_        = new_,
                        confirm     = conf,
                        errMismatch = s.passwordsDoNotMatch,
                        errShort    = s.passwordTooShort,
                    )
                },
                onDismissSuccess = { settingsVm.clearPasswordState() },
            )
        }

        Spacer(Modifier.height(12.dp))

        // ── About section
        SettingsSection(title = s.about, icon = Icons.Outlined.Info) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("WorkHour Worker", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                Text(s.appVersion, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

// ─── Change password form ─────────────────────────────────────────────────────

@Composable
private fun ChangePasswordForm(
    serverUrl: String,
    pwState: PasswordState,
    strings: AppStrings,
    onSubmit: (current: String, new_: String, confirm: String) -> Unit,
    onDismissSuccess: () -> Unit,
) {
    val focus = LocalFocusManager.current
    var current by remember { mutableStateOf("") }
    var new_    by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var showCurrent by remember { mutableStateOf(false) }
    var showNew     by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }

    // Reset fields on success
    LaunchedEffect(pwState.success) {
        if (pwState.success) {
            current = ""; new_ = ""; confirm = ""
        }
    }

    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Success banner
        AnimatedVisibility(visible = pwState.success) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(GreenDim.copy(0.4f))
                    .clickable { onDismissSuccess() }
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.CheckCircleOutline, null, tint = GreenSuccess, modifier = Modifier.size(16.dp))
                Text(strings.passwordChanged, style = MaterialTheme.typography.bodySmall, color = GreenSuccess, modifier = Modifier.weight(1f))
                Icon(Icons.Outlined.Close, null, tint = GreenSuccess.copy(0.6f), modifier = Modifier.size(14.dp))
            }
        }

        // Error banner
        AnimatedVisibility(visible = pwState.error.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(RedDim.copy(0.4f))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = RedDanger, modifier = Modifier.size(16.dp))
                Text(pwState.error, style = MaterialTheme.typography.bodySmall, color = RedDanger)
            }
        }

        // Current password
        PasswordField(
            value      = current,
            onChange   = { current = it },
            label      = strings.currentPassword,
            visible    = showCurrent,
            onToggle   = { showCurrent = !showCurrent },
            imeAction  = ImeAction.Next,
            onImeAction = { focus.moveFocus(FocusDirection.Down) },
        )

        // New password
        PasswordField(
            value      = new_,
            onChange   = { new_ = it },
            label      = strings.newPassword,
            visible    = showNew,
            onToggle   = { showNew = !showNew },
            imeAction  = ImeAction.Next,
            onImeAction = { focus.moveFocus(FocusDirection.Down) },
        )

        // Confirm password
        PasswordField(
            value      = confirm,
            onChange   = { confirm = it },
            label      = strings.confirmPassword,
            visible    = showConfirm,
            onToggle   = { showConfirm = !showConfirm },
            imeAction  = ImeAction.Done,
            onImeAction = { focus.clearFocus(); onSubmit(current, new_, confirm) },
            isError    = confirm.isNotEmpty() && new_ != confirm,
        )

        // Submit button
        Button(
            onClick  = { focus.clearFocus(); onSubmit(current, new_, confirm) },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled  = !pwState.loading && current.isNotBlank() && new_.isNotBlank() && confirm.isNotBlank(),
            shape    = RoundedCornerShape(12.dp),
            colors   = ButtonDefaults.buttonColors(containerColor = AccentPurple),
        ) {
            if (pwState.loading) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
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
    value: String,
    onChange: (String) -> Unit,
    label: String,
    visible: Boolean,
    onToggle: () -> Unit,
    imeAction: ImeAction,
    onImeAction: () -> Unit,
    isError: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        leadingIcon = { Icon(Icons.Outlined.Lock, null, tint = TextSecondary) },
        trailingIcon = {
            IconButton(onClick = onToggle) {
                Icon(
                    if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    null, tint = TextSecondary,
                )
            }
        },
        singleLine = true,
        isError = isError,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(
            onNext = { onImeAction() },
            onDone = { onImeAction() },
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor      = AccentPurple,
            unfocusedBorderColor    = BorderSubtle,
            focusedLabelColor       = AccentPurple,
            unfocusedLabelColor     = TextSecondary,
            focusedTextColor        = TextPrimary,
            unfocusedTextColor      = TextPrimary,
            cursorColor             = AccentPurple,
            unfocusedContainerColor = BgElevated,
            focusedContainerColor   = BgElevated,
            focusedLeadingIconColor = AccentPurple,
        ),
    )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

@Composable
private fun SettingsSection(
    title: String,
    icon: ImageVector,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        // Section header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(bottom = 8.dp, start = 2.dp),
        ) {
            Icon(icon, null, tint = AccentPurple, modifier = Modifier.size(14.dp))
            Text(title, style = MaterialTheme.typography.labelMedium, color = TextMuted, fontWeight = FontWeight.SemiBold)
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(BgCard)
                .border(1.dp, BorderSubtle, RoundedCornerShape(14.dp)),
            content = content,
        )
    }
}
