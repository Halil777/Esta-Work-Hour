package com.esta.workforce.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.esta.workforce.AppContainer
import com.esta.workforce.data.model.AppUser
import com.esta.workforce.data.model.Language
import com.esta.workforce.data.model.UserRole
import com.esta.workforce.data.network.ApiService
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// ─── ViewModel ────────────────────────────────────────────────────────────────

private class LoginViewModel(private val api: ApiService) : ViewModel() {
    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow("")
    val error: StateFlow<String> = _error

    fun login(
        username: String,
        password: String,
        onSuccess: (AppUser, String, UserRole) -> Unit,
    ) {
        if (username.isBlank() || password.isBlank()) {
            _error.value = "Ulanyjy ady we paroly doldur"
            return
        }
        viewModelScope.launch {
            _loading.value = true
            _error.value = ""
            try {
                val res = api.login(
                    com.esta.workforce.data.model.LoginRequest(username.trim(), password.trim())
                )
                val role = if (res.role == "foreman") UserRole.FOREMAN else UserRole.SITE_CHIEF
                val user = AppUser(
                    id = res.workerEntityId,
                    name = res.name,
                    role = role,
                    objectName = "Esta Construction",
                )
                onSuccess(user, res.accessToken, role)
            } catch (e: Exception) {
                _error.value = e.message ?: "Yalnyslyk"
            } finally {
                _loading.value = false
            }
        }
    }

    companion object {
        fun factory(api: ApiService): ViewModelProvider.Factory = viewModelFactory {
            initializer { LoginViewModel(api) }
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@Composable
fun LoginScreen(
    container: AppContainer,
    appVm: AppViewModel,
    onLoginSuccess: (UserRole) -> Unit,
) {
    val vm: LoginViewModel = viewModel(factory = LoginViewModel.factory(container.api))
    val loading by vm.loading.collectAsState()
    val error by vm.error.collectAsState()
    val language by appVm.language.collectAsState()
    val theme by appVm.theme.collectAsState()
    val strings = LocalStrings.current
    val colors = LocalAppColors.current

    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPass by remember { mutableStateOf(false) }

    val langs = listOf(Language.RU, Language.EN, Language.TK)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        // Top bar: language + theme
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                langs.forEach { lang ->
                    val active = language == lang
                    Surface(
                        onClick = { appVm.setLanguage(lang) },
                        shape = RoundedCornerShape(8.dp),
                        color = if (active) Primary else Color.Transparent,
                        modifier = Modifier,
                    ) {
                        Text(
                            text = lang.name,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (active) Color.White else colors.textSecondary,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        )
                    }
                }
            }
            IconButton(onClick = { appVm.toggleTheme() }) {
                Text(
                    text = if (theme == com.esta.workforce.data.model.AppTheme.DARK) "☀" else "☾",
                    fontSize = 18.sp,
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Logo
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Primary,
                modifier = Modifier.size(56.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("E", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(strings.authTitle, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = colors.text)
            Text(strings.authSubtitle, fontSize = 13.sp, color = colors.textMuted)
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card),
            border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Username
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(strings.authUsername, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = colors.textSecondary)
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("bayram", color = colors.textMuted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Primary,
                            unfocusedBorderColor = colors.border,
                            focusedTextColor = colors.text,
                            unfocusedTextColor = colors.text,
                            cursorColor = Primary,
                            focusedContainerColor = colors.card2,
                            unfocusedContainerColor = colors.card2,
                        ),
                        shape = RoundedCornerShape(10.dp),
                    )
                }
                // Password
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(strings.authPassword, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = colors.textSecondary)
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("••••••••", color = colors.textMuted) },
                        singleLine = true,
                        visualTransformation = if (showPass) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        trailingIcon = {
                            IconButton(onClick = { showPass = !showPass }) {
                                Icon(
                                    imageVector = if (showPass) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                    contentDescription = null,
                                    tint = colors.textMuted,
                                )
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Primary,
                            unfocusedBorderColor = colors.border,
                            focusedTextColor = colors.text,
                            unfocusedTextColor = colors.text,
                            cursorColor = Primary,
                            focusedContainerColor = colors.card2,
                            unfocusedContainerColor = colors.card2,
                        ),
                        shape = RoundedCornerShape(10.dp),
                    )
                }

                // Error
                if (error.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = DangerLight,
                    ) {
                        Text(
                            text = error,
                            fontSize = 12.sp,
                            color = Danger,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }

                // Login button
                Button(
                    onClick = {
                        vm.login(username, password) { user, token, role ->
                            appVm.login(user, token)
                            onLoginSuccess(role)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loading,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary),
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp),
                        )
                    } else {
                        Text(
                            text = strings.authLogin,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            modifier = Modifier.padding(vertical = 2.dp),
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Info card
        Card(
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = colors.card2),
            border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Maglumat", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = colors.textSecondary)
                Spacer(modifier = Modifier.height(4.dp))
                Text(strings.authInfo, fontSize = 12.sp, color = colors.textMuted)
            }
        }
    }
}
