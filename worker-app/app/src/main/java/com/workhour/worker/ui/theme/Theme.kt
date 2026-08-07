package com.workhour.worker.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color

enum class AppTheme { DARK, LIGHT }

private val DarkColorScheme = darkColorScheme(
    primary            = AccentPurple,
    onPrimary          = Color.White,
    primaryContainer   = AccentPurpleDim,
    onPrimaryContainer = Color.White,
    secondary          = AccentBlue,
    onSecondary        = Color.White,
    background         = Color(0xFF0D1117),
    onBackground       = Color(0xFFF0F6FC),
    surface            = Color(0xFF161B22),
    onSurface          = Color(0xFFF0F6FC),
    surfaceVariant     = Color(0xFF1C2333),
    onSurfaceVariant   = Color(0xFF8B949E),
    outline            = Color(0xFF30363D),
    error              = RedDanger,
    onError            = Color.White,
)

private val LightColorScheme = lightColorScheme(
    primary            = AccentPurple,
    onPrimary          = Color.White,
    primaryContainer   = Color(0xFFEDE9FF),
    onPrimaryContainer = Color(0xFF110D24),
    secondary          = AccentBlue,
    onSecondary        = Color.White,
    background         = Color(0xFFF1EEF9),
    onBackground       = Color(0xFF110D24),
    surface            = Color(0xFFFFFFFF),
    onSurface          = Color(0xFF110D24),
    surfaceVariant     = Color(0xFFF7F3FE),
    onSurfaceVariant   = Color(0xFF524A6E),
    outline            = Color(0xFFDDD6F3),
    error              = RedDanger,
    onError            = Color.White,
)

@Composable
fun WorkHourTheme(
    language: AppLanguage = AppLanguage.EN,
    theme: AppTheme = AppTheme.DARK,
    content: @Composable () -> Unit,
) {
    val strings = stringsFor(language)
    val palette     = if (theme == AppTheme.DARK) DarkPalette else LightPalette
    val colorScheme = if (theme == AppTheme.DARK) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(
        LocalStrings   provides strings,
        LocalAppColors provides palette,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography  = AppTypography,
            content     = content,
        )
    }
}
