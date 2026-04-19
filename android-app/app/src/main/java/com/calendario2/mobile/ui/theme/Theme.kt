package com.calendario2.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Slate950 = Color(0xFF020617)
private val Slate900 = Color(0xFF0f172a)
private val Slate800 = Color(0xFF1e293b)
private val Sky400 = Color(0xFF38bdf8)
private val Sky500 = Color(0xFF0ea5e9)
private val Violet500 = Color(0xFF8b5cf6)
private val White88 = Color(0xE0ffffff)
private val White55 = Color(0x8Cffffff)

private val CalendarioDark = darkColorScheme(
    primary = Sky400,
    onPrimary = Slate950,
    primaryContainer = Slate800,
    secondary = Violet500,
    onSecondary = Color.White,
    background = Slate950,
    surface = Slate900,
    surfaceVariant = Slate800,
    onBackground = White88,
    onSurface = White88,
    onSurfaceVariant = White55,
)

@Composable
fun CalendarioTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme() || true
    MaterialTheme(
        colorScheme = if (dark) CalendarioDark else CalendarioDark,
        content = content,
    )
}
