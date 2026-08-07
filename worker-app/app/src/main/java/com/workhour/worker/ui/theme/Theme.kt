package com.workhour.worker.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

private val DarkColors = darkColorScheme(
    primary             = AccentPurple,
    onPrimary           = TextPrimary,
    primaryContainer    = AccentPurpleDim,
    onPrimaryContainer  = TextPrimary,
    secondary           = AccentBlue,
    onSecondary         = TextPrimary,
    background          = BgDeep,
    onBackground        = TextPrimary,
    surface             = BgSurface,
    onSurface           = TextPrimary,
    surfaceVariant      = BgCard,
    onSurfaceVariant    = TextSecondary,
    outline             = BorderSubtle,
    error               = RedDanger,
    onError             = TextPrimary,
)

@Composable
fun WorkHourTheme(
    language: AppLanguage = AppLanguage.EN,
    content: @Composable () -> Unit,
) {
    val strings = when (language) {
        AppLanguage.EN -> EnStrings
        AppLanguage.RU -> RuStrings
        AppLanguage.TR -> TrStrings
    }
    CompositionLocalProvider(LocalStrings provides strings) {
        MaterialTheme(
            colorScheme = DarkColors,
            typography  = AppTypography,
            content     = content,
        )
    }
}
