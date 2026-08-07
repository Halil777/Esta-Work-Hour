package com.workhour.worker.ui.auth

import androidx.compose.foundation.background
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.workhour.worker.data.model.LoginRequest
import com.workhour.worker.data.model.SavedUser
import com.workhour.worker.data.network.ApiClient
import com.workhour.worker.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    serverUrl: String,
    onLoggedIn: (token: String, user: SavedUser) -> Unit,
    onChangeServer: () -> Unit,
) {
    val s     = LocalStrings.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current

    var username        by remember { mutableStateOf("") }
    var password        by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var loading         by remember { mutableStateOf(false) }
    var error           by remember { mutableStateOf("") }

    fun doLogin() {
        if (username.isBlank() || password.isBlank()) return
        scope.launch {
            loading = true; error = ""
            try {
                val resp = ApiClient.get(serverUrl).login(LoginRequest(username.trim(), password))
                if (resp.role !in listOf("worker", "section_chief")) {
                    error   = s.workersOnlyWarning
                    loading = false
                    return@launch
                }
                onLoggedIn(resp.accessToken, SavedUser(resp.workerEntityId, resp.name, resp.role))
            } catch (e: Exception) {
                error = when {
                    e.message?.contains("401") == true || e.message?.contains("Unauthorized") == true ->
                        s.invalidCredentials
                    e.message?.contains("connect", ignoreCase = true) == true ||
                    e.message?.contains("Unable to resolve") == true ->
                        s.serverUnreachable
                    else -> e.message ?: "Login failed"
                }
            } finally {
                loading = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(BgDeep), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .background(Brush.radialGradient(listOf(AccentPurple.copy(0.35f), BgCard)), RoundedCornerShape(22.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.AccessTime, null, tint = AccentPurple, modifier = Modifier.size(38.dp))
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("WorkHour", style = MaterialTheme.typography.headlineSmall, color = TextPrimary, fontWeight = FontWeight.Bold)
                Text(s.signInWithCredentials, style = MaterialTheme.typography.bodySmall, color = TextSecondary, textAlign = TextAlign.Center)
            }

            if (error.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth().background(RedDim.copy(0.45f), RoundedCornerShape(10.dp)).padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(Icons.Outlined.ErrorOutline, null, tint = RedDanger, modifier = Modifier.size(16.dp))
                    Text(error, style = MaterialTheme.typography.bodySmall, color = RedDanger)
                }
            }

            OutlinedTextField(
                value = username, onValueChange = { username = it; error = "" },
                modifier = Modifier.fillMaxWidth(), label = { Text(s.username) },
                leadingIcon = { Icon(Icons.Outlined.Person, null, tint = TextSecondary) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) }),
                colors = tfColors(),
            )

            OutlinedTextField(
                value = password, onValueChange = { password = it; error = "" },
                modifier = Modifier.fillMaxWidth(), label = { Text(s.password) },
                leadingIcon = { Icon(Icons.Outlined.Lock, null, tint = TextSecondary) },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null, tint = TextSecondary)
                    }
                },
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); doLogin() }),
                colors = tfColors(),
            )

            Button(
                onClick = { focus.clearFocus(); doLogin() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !loading,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
            ) {
                if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = TextPrimary, strokeWidth = 2.dp)
                else Text(s.signIn, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }

            TextButton(onClick = onChangeServer) {
                Icon(Icons.Outlined.Cloud, null, tint = TextMuted, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(5.dp))
                Text(
                    "${s.changeServer}  (${serverUrl.take(36)}${if (serverUrl.length > 36) "…" else ""})",
                    style = MaterialTheme.typography.labelSmall, color = TextMuted,
                )
            }
        }
    }
}

@Composable
private fun tfColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor      = AccentPurple, unfocusedBorderColor    = BorderSubtle,
    focusedLabelColor       = AccentPurple, unfocusedLabelColor     = TextSecondary,
    focusedTextColor        = TextPrimary,  unfocusedTextColor      = TextPrimary,
    cursorColor             = AccentPurple, unfocusedContainerColor = BgCard,
    focusedContainerColor   = BgCard,       focusedLeadingIconColor = AccentPurple,
)
