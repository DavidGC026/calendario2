package com.calendario2.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Paleta de marca DVG: carmín + dorado sobre carbón cálido.
 * Conserva las superficies de cristal sin introducir subtonos morados.
 */
object DvgColors {
    val Slate950 = Color(0xFF0C0B0A)
    val Slate900 = Color(0xFF151311)
    val Slate800 = Color(0xFF25211E)
    val Slate700 = Color(0xFF3A332D)

    val BrandRed = Color(0xFFA61B24)
    val BrandRedSoft = Color(0xFFC7353E)
    val BrandRedDark = Color(0xFF4A090D)

    val Gold300 = Color(0xFFEFD98E)
    val Gold400 = Color(0xFFE7C66A)
    val Gold500 = Color(0xFFC38A2B)
    val Gold600 = Color(0xFFA66A18)
    val GoldDark = Color(0xFF4C2C08)

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
    primary = DvgColors.BrandRed,
    onPrimary = Color.White,
    primaryContainer = DvgColors.BrandRedDark,
    secondary = DvgColors.Gold500,
    onSecondary = Color.White,
    tertiary = DvgColors.Gold400,
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
