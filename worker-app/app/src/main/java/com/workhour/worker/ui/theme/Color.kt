package com.workhour.worker.ui.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// ─── Brand & Status — unchanged in both themes ────────────────────────────────
val AccentPurple    = Color(0xFF8B5CF6)
val AccentPurpleDim = Color(0xFF6D28D9)
val AccentBlue      = Color(0xFF3B82F6)
val GreenSuccess    = Color(0xFF10B981)
val OrangeWarning   = Color(0xFFF59E0B)
val RedDanger       = Color(0xFFEF4444)

// ─── Theme-aware palette ──────────────────────────────────────────────────────
data class AppColors(
    val bgDeep: Color,
    val bgSurface: Color,
    val bgCard: Color,
    val bgElevated: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val borderSubtle: Color,
    val greenDim: Color,
    val orangeDim: Color,
    val redDim: Color,
    val isDark: Boolean,
)

val DarkPalette = AppColors(
    bgDeep        = Color(0xFF0D1117),
    bgSurface     = Color(0xFF161B22),
    bgCard        = Color(0xFF1C2333),
    bgElevated    = Color(0xFF21262D),
    textPrimary   = Color(0xFFF0F6FC),
    textSecondary = Color(0xFF8B949E),
    textMuted     = Color(0xFF6E7681),
    borderSubtle  = Color(0xFF30363D),
    greenDim      = Color(0xFF065F46),
    orangeDim     = Color(0xFF92400E),
    redDim        = Color(0xFF7F1D1D),
    isDark        = true,
)

val LightPalette = AppColors(
    bgDeep        = Color(0xFFF1EEF9),
    bgSurface     = Color(0xFFE6E1F4),
    bgCard        = Color(0xFFFFFFFF),
    bgElevated    = Color(0xFFF7F3FE),
    textPrimary   = Color(0xFF110D24),
    textSecondary = Color(0xFF524A6E),
    textMuted     = Color(0xFF9890B5),
    borderSubtle  = Color(0xFFDDD6F3),
    greenDim      = Color(0xFFD1FAE5),
    orangeDim     = Color(0xFFFEF3C7),
    redDim        = Color(0xFFFEE2E2),
    isDark        = false,
)

val LocalAppColors = staticCompositionLocalOf { DarkPalette }
