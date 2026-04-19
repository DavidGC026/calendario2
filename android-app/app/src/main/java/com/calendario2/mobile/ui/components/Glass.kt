package com.calendario2.mobile.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.calendario2.mobile.ui.theme.DvgColors

/**
 * Equivalente al `glassPanel` de la web:
 *   bg-gradient-to-br from-white/15 via-white/8 to-white/5,
 *   border-white/20, rounded-2xl, shadow + backdrop-blur.
 */
fun Modifier.glassPanel(radius: Dp = 18.dp): Modifier =
    this.clip(RoundedCornerShape(radius))
        .background(
            brush = Brush.linearGradient(
                listOf(
                    Color(0x26FFFFFF),
                    Color(0x14FFFFFF),
                    Color(0x0DFFFFFF),
                ),
            ),
        )
        .border(BorderStroke(1.dp, DvgColors.White15), RoundedCornerShape(radius))

/**
 * `glassInset` de la web: tarjetas pequeñas / inputs / chips.
 */
fun Modifier.glassInset(radius: Dp = 12.dp): Modifier =
    this.clip(RoundedCornerShape(radius))
        .background(DvgColors.White5)
        .border(BorderStroke(1.dp, DvgColors.White15), RoundedCornerShape(radius))

/**
 * Botón primario violet → sky (igual que el FAB de IA y el botón "Aceptar"
 * del bienvenida en la web).
 */
@Composable
fun primaryGradient(): Brush = Brush.linearGradient(
    colors = listOf(DvgColors.Violet600, DvgColors.Sky500),
)

/** Sky → blue (botón "Sí, abrir IA" en la web). */
@Composable
fun skyGradient(): Brush = Brush.linearGradient(
    colors = listOf(DvgColors.Sky500, DvgColors.Blue600),
)
