package com.calendario2.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.ui.theme.DvgColors

/** Marca compacta DVG equivalente al monograma vectorial de la web. */
@Composable
fun DvgMark(
    size: Dp = 40.dp,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(size * 0.28f)
    Box(
        modifier = modifier
            .size(size)
            .clearAndSetSemantics { }
            .clip(shape)
            .background(
                Brush.linearGradient(
                    listOf(DvgColors.BrandRedSoft, DvgColors.BrandRedDark),
                ),
            )
            .border(1.dp, DvgColors.Gold400.copy(alpha = 0.75f), shape),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = size * 0.18f)
                .fillMaxWidth(0.68f)
                .height((size * 0.055f).coerceAtLeast(1.dp))
                .background(DvgColors.Gold400, RoundedCornerShape(99.dp)),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset(x = size * 0.22f, y = size * 0.10f)
                .width((size * 0.06f).coerceAtLeast(1.dp))
                .height(size * 0.20f)
                .background(DvgColors.Gold400, RoundedCornerShape(99.dp)),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = -(size * 0.22f), y = size * 0.10f)
                .width((size * 0.06f).coerceAtLeast(1.dp))
                .height(size * 0.20f)
                .background(DvgColors.Gold400, RoundedCornerShape(99.dp)),
        )
        Text(
            text = "DVG",
            modifier = Modifier.offset(y = size * 0.09f),
            color = DvgColors.Gold300,
            fontSize = (size.value * 0.23f).sp,
            fontWeight = FontWeight.Black,
            letterSpacing = (size.value * 0.005f).sp,
        )
    }
}
