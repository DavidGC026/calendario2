package com.calendario2.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Paleta web (Tailwind sky + violet sobre slate-950) usada por la página
 * principal y los correos. Mismo lenguaje visual que la app de escritorio.
 */
object DvgColors {
    val Slate950 = Color(0xFF020617)
    val Slate900 = Color(0xFF0f172a)
    val Slate800 = Color(0xFF1e293b)
    val Slate700 = Color(0xFF334155)

    val Sky200 = Color(0xFFbae6fd)
    val Sky300 = Color(0xFF7dd3fc)
    val Sky400 = Color(0xFF38bdf8)
    val Sky500 = Color(0xFF0ea5e9)
    val Sky600 = Color(0xFF0284c7)

    val Violet400 = Color(0xFFa78bfa)
    val Violet500 = Color(0xFF8b5cf6)
    val Violet600 = Color(0xFF7c3aed)

    val Blue500 = Color(0xFF3b82f6)
    val Blue600 = Color(0xFF2563eb)
    val Rose500 = Color(0xFFf43f5e)
    val Rose400 = Color(0xFFfb7185)

    val White95 = Color(0xF2FFFFFF)
    val White88 = Color(0xE0FFFFFF)
    val White80 = Color(0xCCFFFFFF)
    val White65 = Color(0xA6FFFFFF)
    val White55 = Color(0x8CFFFFFF)
    val White45 = Color(0x73FFFFFF)
    val White35 = Color(0x59FFFFFF)
    val White15 = Color(0x26FFFFFF)
    val White10 = Color(0x1AFFFFFF)
    val White7 = Color(0x12FFFFFF)
    val White5 = Color(0x0DFFFFFF)
}

private val DvgColorScheme = darkColorScheme(
    primary = DvgColors.Sky500,
    onPrimary = Color.White,
    primaryContainer = DvgColors.Sky600,
    secondary = DvgColors.Violet500,
    onSecondary = Color.White,
    tertiary = DvgColors.Rose500,
    onTertiary = Color.White,
    background = DvgColors.Slate950,
    onBackground = DvgColors.White88,
    surface = DvgColors.Slate900,
    onSurface = DvgColors.White88,
    surfaceVariant = DvgColors.Slate800,
    onSurfaceVariant = DvgColors.White55,
    outline = DvgColors.White15,
    error = Color(0xFFFCA5A5),
)

@Composable
fun CalendarioTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DvgColorScheme,
        content = content,
    )
}
