package com.calendario2.mobile.ui.ai

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.calendario2.mobile.ui.components.glassInset
import com.calendario2.mobile.ui.components.primaryGradient
import com.calendario2.mobile.ui.theme.DvgColors

/** Estado del micrófono visible en el chat. */
enum class VoiceUiState { Idle, Recording, Transcribing }

data class ChatBubble(
    val role: String,
    val text: String,
    val streaming: Boolean = false,
    val imageDataUrls: List<String> = emptyList(),
)

@Composable
fun ChatSheet(
    messages: List<ChatBubble>,
    sending: Boolean,
    error: String?,
    pendingImages: List<String>,
    voiceState: VoiceUiState,
    onSend: (text: String, images: List<String>) -> Unit,
    onClose: () -> Unit,
    onPickImage: () -> Unit,
    onTakePhoto: () -> Unit,
    onRemovePendingImage: (Int) -> Unit,
    onToggleVoice: () -> Unit,
) {
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val sheetInteraction = remember { MutableInteractionSource() }

    fun trySend() {
        if (sending) return
        if (input.isBlank() && pendingImages.isEmpty()) return
        val txt = input.trim()
        input = ""
        onSend(txt, pendingImages)
    }

    LaunchedEffect(messages.size, messages.lastOrNull()?.text) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
            .clickable { onClose() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .align(Alignment.BottomCenter)
                .imePadding()
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(DvgColors.Slate950.copy(alpha = 0.96f))
                .border(
                    width = 1.dp,
                    color = DvgColors.White15,
                    shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
                )
                .clickable(
                    interactionSource = sheetInteraction,
                    indication = null,
                ) { /* consume toques: no cerrar al escribir / IME */ }
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(primaryGradient()),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.size(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Asistente IA", color = DvgColors.White95, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    val subtitle = when {
                        voiceState == VoiceUiState.Recording -> "Grabando…"
                        voiceState == VoiceUiState.Transcribing -> "Transcribiendo…"
                        sending -> "Pensando…"
                        else -> "Crea, edita y consulta eventos por chat"
                    }
                    Text(
                        subtitle,
                        color = if (sending || voiceState != VoiceUiState.Idle) DvgColors.Sky300 else DvgColors.White55,
                        fontSize = 11.sp,
                    )
                }
                IconButton(onClick = onClose, enabled = !sending) {
                    Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = DvgColors.White65)
                }
            }
            Spacer(Modifier.height(8.dp))

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (messages.isEmpty()) {
                    item { EmptyState() }
                }
                items(messages) { msg ->
                    Bubble(msg)
                }
                if (error != null) {
                    item {
                        Text(error, color = Color(0xFFFCA5A5), fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp))
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            if (pendingImages.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    itemsIndexed(pendingImages) { index, url ->
                        ImageThumb(url) { onRemovePendingImage(index) }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ToolButton(icon = Icons.Default.Image, contentDescription = "Adjuntar imagen", onClick = onPickImage)
                Spacer(Modifier.width(4.dp))
                ToolButton(icon = Icons.Default.PhotoCamera, contentDescription = "Tomar foto", onClick = onTakePhoto)
                Spacer(Modifier.width(4.dp))
                ToolButton(
                    icon = if (voiceState == VoiceUiState.Recording) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = "Nota de voz",
                    onClick = onToggleVoice,
                    highlighted = voiceState == VoiceUiState.Recording,
                    loading = voiceState == VoiceUiState.Transcribing,
                )
                Spacer(Modifier.width(6.dp))
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text("Mensaje, imagen o voz…", color = DvgColors.White45) },
                    modifier = Modifier.weight(1f).glassInset(),
                    enabled = !sending,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { trySend() }),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DvgColors.White95,
                        unfocusedTextColor = DvgColors.White95,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedBorderColor = DvgColors.Violet400.copy(alpha = 0.7f),
                        unfocusedBorderColor = Color.Transparent,
                        cursorColor = DvgColors.Violet400,
                    ),
                )
                Spacer(Modifier.size(8.dp))
                val canSend = !sending && (input.isNotBlank() || pendingImages.isNotEmpty())
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(primaryGradient())
                        .clickable(enabled = canSend) { trySend() },
                    contentAlignment = Alignment.Center,
                ) {
                    if (sending) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Enviar", tint = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun ToolButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    highlighted: Boolean = false,
    loading: Boolean = false,
) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(
                if (highlighted) DvgColors.Rose500.copy(alpha = 0.45f)
                else DvgColors.White10,
            )
            .border(
                width = 1.dp,
                color = if (highlighted) DvgColors.Rose500.copy(alpha = 0.7f) else DvgColors.White15,
                shape = CircleShape,
            )
            .clickable(enabled = !loading) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = DvgColors.Sky300, strokeWidth = 2.dp)
        } else {
            Icon(icon, contentDescription = contentDescription, tint = DvgColors.White95, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun ImageThumb(url: String, onRemove: () -> Unit) {
    val context = LocalContext.current
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(DvgColors.White10)
            .border(1.dp, DvgColors.White15, RoundedCornerShape(10.dp)),
    ) {
        AsyncImage(
            model = ImageRequest.Builder(context).data(url).build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(20.dp)
                .clip(CircleShape)
                .background(Color(0xCC000000))
                .clickable { onRemove() },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Close, contentDescription = "Quitar", tint = Color.White, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun Bubble(msg: ChatBubble) {
    val isUser = msg.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            modifier = Modifier
                .clip(
                    if (isUser) RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomStart = 14.dp, bottomEnd = 4.dp)
                    else RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomStart = 4.dp, bottomEnd = 14.dp)
                )
                .background(if (isUser) DvgColors.Sky500.copy(alpha = 0.30f) else DvgColors.White5)
                .border(
                    width = 1.dp,
                    color = if (isUser) DvgColors.Sky400.copy(alpha = 0.4f) else DvgColors.White15,
                    shape = RoundedCornerShape(14.dp),
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (msg.imageDataUrls.isNotEmpty()) {
                val context = LocalContext.current
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(msg.imageDataUrls) { url ->
                        AsyncImage(
                            model = ImageRequest.Builder(context).data(url).build(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(120.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.Black),
                        )
                    }
                }
                if (msg.text.isNotBlank()) Spacer(Modifier.height(6.dp))
            }
            if (msg.text.isNotBlank() || msg.imageDataUrls.isEmpty()) {
                Text(
                    text = if (msg.streaming && msg.text.isEmpty()) "…" else msg.text,
                    color = DvgColors.White95,
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 30.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = DvgColors.Sky300, modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(8.dp))
        Text("Pídeme algo como:", color = DvgColors.White80, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(6.dp))
        Suggestion("Agenda un café con Ana mañana a las 10")
        Suggestion("Adjunta una captura del cartel")
        Suggestion("Recuérdame el dentista el 25 a las 17:00")
    }
}

@Composable
private fun Suggestion(text: String) {
    Box(
        modifier = Modifier
            .padding(top = 4.dp)
            .glassInset()
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(text, color = DvgColors.White65, fontSize = 11.sp)
    }
}
