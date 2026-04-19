package com.calendario2.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.rememberAsyncImagePainter
import coil.request.ImageRequest
import com.calendario2.mobile.data.PreferencesStore

@Composable
fun AppBackground(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val prefs = remember(context) { PreferencesStore(context) }
    val customUri by prefs.backgroundUriFlow.collectAsState(initial = null)
    val source = customUri ?: PreferencesStore.DEFAULT_BACKGROUND_URL

    val painter = rememberAsyncImagePainter(
        ImageRequest.Builder(context)
            .data(source)
            .crossfade(true)
            .build(),
    )

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF020617))) {
        Image(
            painter = painter,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0xB30b1226),
                            Color(0x8C0b1226),
                            Color(0xD9020617),
                        ),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0x408b5cf6),
                            Color(0x00000000),
                        ),
                        radius = 900f,
                    ),
                ),
        )
        content()
    }
}
