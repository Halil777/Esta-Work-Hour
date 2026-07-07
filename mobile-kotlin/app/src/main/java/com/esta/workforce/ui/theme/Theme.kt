package com.esta.workforce.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.esta.workforce.data.model.AppTheme
import com.esta.workforce.ui.AppViewModel

private val DarkColorScheme = darkColorScheme(
    primary = Primary,
    background = DarkBg,
    surface = DarkCard,
    onBackground = DarkText,
    onSurface = DarkText,
)

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    background = LightBg,
    surface = LightCard,
    onBackground = LightText,
    onSurface = LightText,
)

@Composable
fun WorkforceTheme(
    appVm: AppViewModel,
    content: @Composable () -> Unit,
) {
    val theme by appVm.theme.collectAsState()
    val isDark = theme == AppTheme.DARK
    val appColors = if (isDark) DarkAppColors else LightAppColors
    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(
        LocalAppColors provides appColors,
        LocalStrings provides appVm.strings.collectAsState().value,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = WorkforceTypography,
            content = content,
        )
    }
}
