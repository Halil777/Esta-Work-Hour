package com.esta.workforce.ui.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class AppColors(
    val bg: Color,
    val card: Color,
    val card2: Color,
    val text: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val border: Color,
    val tabBar: Color,
    val primary: Color = Primary,
    val success: Color = Success,
    val successLight: Color = SuccessLight,
    val warning: Color = Warning,
    val warningLight: Color = WarningLight,
    val danger: Color = Danger,
    val dangerLight: Color = DangerLight,
    val info: Color = Info,
    val infoLight: Color = InfoLight,
    val primaryLight: Color = PrimaryLight,
)

val DarkAppColors = AppColors(
    bg = DarkBg,
    card = DarkCard,
    card2 = DarkCard2,
    text = DarkText,
    textSecondary = DarkTextSecondary,
    textMuted = DarkTextMuted,
    border = DarkBorder,
    tabBar = DarkTabBar,
)

val LightAppColors = AppColors(
    bg = LightBg,
    card = LightCard,
    card2 = LightCard2,
    text = LightText,
    textSecondary = LightTextSecondary,
    textMuted = LightTextMuted,
    border = LightBorder,
    tabBar = LightTabBar,
)

val LocalAppColors = staticCompositionLocalOf { DarkAppColors }
