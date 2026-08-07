package com.workhour.worker.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.workhour.worker.ui.theme.*

@Composable
fun SetupScreen(onSave: (String) -> Unit) {
    val s = LocalStrings.current
    var url   by remember { mutableStateOf("http://") }
    var error by remember { mutableStateOf("") }

    fun validate(): Boolean {
        return when {
            url.isBlank() || url == "http://" -> { error = s.invalidServerAddress; false }
            !url.startsWith("http")           -> { error = s.addressMustStartHttp; false }
            else                              -> { error = ""; true }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(BgDeep), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(Brush.radialGradient(listOf(AccentPurple.copy(0.3f), BgCard)), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Language, null, tint = AccentPurple, modifier = Modifier.size(36.dp))
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(s.connectToWorkHour, style = MaterialTheme.typography.headlineSmall, color = TextPrimary)
                Text(s.enterServerAddress, style = MaterialTheme.typography.bodyMedium, color = TextSecondary, textAlign = TextAlign.Center)
            }

            OutlinedTextField(
                value = url, onValueChange = { url = it; error = "" },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Server Address") },
                placeholder = { Text("http://192.168.1.100:3002") },
                singleLine = true,
                isError = error.isNotEmpty(),
                supportingText = if (error.isNotEmpty()) { { Text(error, color = MaterialTheme.colorScheme.error) } } else null,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { if (validate()) onSave(url) }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentPurple, unfocusedBorderColor = BorderSubtle,
                    focusedLabelColor = AccentPurple, unfocusedLabelColor = TextSecondary,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                    cursorColor = AccentPurple, unfocusedContainerColor = BgCard, focusedContainerColor = BgCard,
                ),
            )

            Button(
                onClick = { if (validate()) onSave(url) },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
            ) {
                Text(s.continue_, style = MaterialTheme.typography.titleSmall)
            }
        }
    }
}
