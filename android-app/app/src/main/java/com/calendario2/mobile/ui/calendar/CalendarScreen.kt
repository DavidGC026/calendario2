package com.calendario2.mobile.ui.calendar

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.AlarmOn
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.ai.ChatAttachments
import com.calendario2.mobile.ai.ChatClient
import com.calendario2.mobile.ai.ChatStreamEvent
import com.calendario2.mobile.ai.UiChatMessage
import com.calendario2.mobile.ai.VoiceRecorder
import com.calendario2.mobile.data.CalendarioApi
import com.calendario2.mobile.data.CreateEventBody
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.data.PreferencesStore
import com.calendario2.mobile.data.UpdateEventBody
import com.calendario2.mobile.notifications.NotificationActions
import com.calendario2.mobile.notifications.ReminderScheduler
import com.calendario2.mobile.ui.ai.ChatBubble
import com.calendario2.mobile.ui.ai.ChatSheet
import com.calendario2.mobile.ui.ai.VoiceUiState
import com.calendario2.mobile.ui.components.BottomNavBar
import com.calendario2.mobile.ui.components.CalendarMode
import com.calendario2.mobile.ui.components.primaryGradient
import com.calendario2.mobile.ui.event.EventDetailSheet
import com.calendario2.mobile.ui.event.EventDraft
import com.calendario2.mobile.ui.event.EventSheet
import com.calendario2.mobile.ui.event.toDraft
import com.calendario2.mobile.ui.theme.DvgColors
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth

@Composable
fun CalendarScreen(
    api: CalendarioApi,
    baseUrl: String,
    tokenProvider: () -> String?,
    events: List<EventDto>,
    loading: Boolean,
    error: String?,
    initialDate: LocalDate? = null,
    onInitialDateConsumed: () -> Unit = {},
    onRefresh: () -> Unit,
    onSyncReminders: () -> Unit,
    onLogout: () -> Unit,
) {
    val today = remember { LocalDate.now() }
    var mode by remember { mutableStateOf(CalendarMode.Month) }
    var selectedDate by remember { mutableStateOf(today) }
    var month by remember { mutableStateOf(YearMonth.from(today)) }

    // Apertura desde notificación: salta al día del evento.
    LaunchedEffect(initialDate) {
        val d = initialDate ?: return@LaunchedEffect
        selectedDate = d
        month = YearMonth.from(d)
        mode = CalendarMode.Day
        onInitialDateConsumed()
    }

    var detailEvent by remember { mutableStateOf<EventDto?>(null) }
    var sheetDraft by remember { mutableStateOf<EventDraft?>(null) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }

    var aiOpen by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }

    var chatMessages by remember { mutableStateOf<List<ChatBubble>>(emptyList()) }
    var chatSending by remember { mutableStateOf(false) }
    var chatError by remember { mutableStateOf<String?>(null) }
    var pendingImages by remember { mutableStateOf<List<String>>(emptyList()) }
    var voiceState by remember { mutableStateOf(VoiceUiState.Idle) }
    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }

    val context = LocalContext.current
    val prefs = remember(context) { PreferencesStore(context) }
    val chatClient = remember(baseUrl) { ChatClient(baseUrl) { tokenProvider() } }
    val voiceRecorder = remember(context) { VoiceRecorder(context) }
    val scope = rememberCoroutineScope()

    val pickBackground = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            } catch (_: Exception) { /* algunos providers no soportan persist */ }
            scope.launch { prefs.setBackgroundUri(uri.toString()) }
        }
    }

    val pickChatImage = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri != null) {
            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                val data = ChatAttachments.fromUri(context, uri)
                if (data != null) {
                    scope.launch { pendingImages = pendingImages + data }
                } else {
                    scope.launch { chatError = "No se pudo procesar la imagen" }
                }
            }
        }
    }

    val takeChatPhoto = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { ok: Boolean ->
        val uri = pendingCameraUri
        pendingCameraUri = null
        if (ok && uri != null) {
            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                val data = ChatAttachments.fromUri(context, uri)
                if (data != null) {
                    scope.launch { pendingImages = pendingImages + data }
                }
            }
        }
    }

    val requestCameraPerm = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) launchTakePhoto(context, takeChatPhoto) { pendingCameraUri = it }
        else chatError = "Permiso de cámara denegado"
    }

    val requestMicPerm = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) {
            chatError = "Permiso de micrófono denegado"
            return@rememberLauncherForActivityResult
        }
        if (voiceRecorder.start()) voiceState = VoiceUiState.Recording
        else chatError = "No se pudo iniciar la grabación"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 12.dp),
    ) {
        Header(
            mode = mode,
            month = month,
            selectedDate = selectedDate,
            onPrev = {
                when (mode) {
                    CalendarMode.Month -> month = month.minusMonths(1)
                    CalendarMode.Week -> selectedDate = selectedDate.minusWeeks(1)
                    CalendarMode.Day -> selectedDate = selectedDate.minusDays(1)
                }
            },
            onNext = {
                when (mode) {
                    CalendarMode.Month -> month = month.plusMonths(1)
                    CalendarMode.Week -> selectedDate = selectedDate.plusWeeks(1)
                    CalendarMode.Day -> selectedDate = selectedDate.plusDays(1)
                }
            },
            onMenu = { menuOpen = true },
            menuOpen = menuOpen,
            onMenuDismiss = { menuOpen = false },
            onRefresh = { menuOpen = false; onRefresh() },
            onSyncReminders = { menuOpen = false; onSyncReminders() },
            onLogout = { menuOpen = false; onLogout() },
            onChangeBackground = {
                menuOpen = false
                pickBackground.launch(arrayOf("image/*"))
            },
            onResetBackground = {
                menuOpen = false
                scope.launch { prefs.setBackgroundUri(null) }
            },
            onTestNotification = {
                menuOpen = false
                NotificationActions.fireTestNotification(context)
            },
            onGrantExactAlarms = if (!ReminderScheduler.canScheduleExact(context)) {
                {
                    menuOpen = false
                    NotificationActions.openExactAlarmSettings(context)
                }
            } else null,
        )

        Spacer(Modifier.height(8.dp))

        if (loading && events.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(top = 40.dp), contentAlignment = Alignment.TopCenter) {
                CircularProgressIndicator(color = DvgColors.Sky400)
            }
        } else {
            error?.let {
                Text(it, color = Color(0xFFFCA5A5), fontSize = 12.sp, modifier = Modifier.padding(bottom = 6.dp))
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when (mode) {
                    CalendarMode.Month -> MonthView(
                        month = month,
                        selectedDate = selectedDate,
                        today = today,
                        events = events,
                        onSelectDate = { date ->
                            selectedDate = date
                            month = YearMonth.from(date)
                            mode = CalendarMode.Day
                        },
                    )
                    CalendarMode.Week -> WeekView(
                        selectedDate = selectedDate,
                        today = today,
                        events = events,
                        onEventClick = { detailEvent = it },
                        onSelectDay = { date ->
                            selectedDate = date
                            mode = CalendarMode.Day
                        },
                    )
                    CalendarMode.Day -> DayView(
                        date = selectedDate,
                        today = today,
                        events = events,
                        onEventClick = { detailEvent = it },
                        onCreateAt = { date, hour ->
                            sheetDraft = EventDraft(
                                date = date,
                                start = LocalTime.of(hour, 0),
                                end = LocalTime.of(hour + 1, 0),
                            )
                        },
                    )
                }
            }
        }

        BottomNavBar(
            mode = mode,
            onSelectMode = { mode = it },
            onGoToday = {
                selectedDate = today
                month = YearMonth.from(today)
                if (mode == CalendarMode.Month) mode = CalendarMode.Day
            },
        )
        Spacer(Modifier.windowInsetsPadding(WindowInsets.navigationBars))
    }

    // FABs flotantes
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(end = 18.dp, bottom = 96.dp)
            .windowInsetsPadding(WindowInsets.navigationBars),
    ) {
        Column(
            modifier = Modifier.align(Alignment.BottomEnd),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            FabSecondary(
                icon = Icons.Default.AutoAwesome,
                description = "Asistente IA",
                onClick = { aiOpen = true },
            )
            FabPrimary(
                icon = Icons.Default.Add,
                description = "Crear evento",
                onClick = {
                    sheetDraft = EventDraft(
                        date = selectedDate,
                        start = LocalTime.of(9, 0),
                        end = LocalTime.of(10, 0),
                    )
                },
            )
        }
    }

    // Detalles del evento (estilo email Resend)
    detailEvent?.let { ev ->
        EventDetailSheet(
            event = ev,
            onClose = { detailEvent = null },
            onEdit = {
                sheetDraft = ev.toDraft()
                detailEvent = null
            },
            onDelete = {
                scope.launch {
                    try {
                        api.deleteEvent(ev.id)
                        detailEvent = null
                        onRefresh()
                    } catch (e: Exception) {
                        saveError = e.message
                    }
                }
            },
        )
    }

    // Crear / editar evento
    sheetDraft?.let { d ->
        EventSheet(
            initial = d,
            saving = saving,
            error = saveError,
            onSave = { draft ->
                scope.launch {
                    saving = true
                    saveError = null
                    try {
                        if (draft.id == null) {
                            api.createEvent(
                                CreateEventBody(
                                    title = draft.title,
                                    eventDate = draft.date.toString(),
                                    startTime = "%02d:%02d".format(draft.start.hour, draft.start.minute),
                                    endTime = "%02d:%02d".format(draft.end.hour, draft.end.minute),
                                    description = draft.description.takeIf { it.isNotBlank() },
                                    location = draft.location.takeIf { it.isNotBlank() },
                                    color = draft.color,
                                    reminderMinutesBefore = draft.reminderMinutes,
                                    emailRemindersEnabled = draft.emailRemindersEnabled,
                                ),
                            )
                        } else {
                            api.updateEvent(
                                draft.id,
                                UpdateEventBody(
                                    title = draft.title,
                                    eventDate = draft.date.toString(),
                                    startTime = "%02d:%02d".format(draft.start.hour, draft.start.minute),
                                    endTime = "%02d:%02d".format(draft.end.hour, draft.end.minute),
                                    description = draft.description,
                                    location = draft.location,
                                    color = draft.color,
                                    reminderMinutesBefore = draft.reminderMinutes,
                                    emailRemindersEnabled = draft.emailRemindersEnabled,
                                ),
                            )
                        }
                        sheetDraft = null
                        onRefresh()
                    } catch (e: Exception) {
                        saveError = e.message ?: "Error al guardar"
                    } finally {
                        saving = false
                    }
                }
            },
            onDelete = if (d.id != null) {
                {
                    scope.launch {
                        try {
                            api.deleteEvent(d.id)
                            sheetDraft = null
                            onRefresh()
                        } catch (e: Exception) {
                            saveError = e.message
                        }
                    }
                }
            } else null,
            onClose = { sheetDraft = null },
        )
    }

    // Chat IA
    if (aiOpen) {
        ChatSheet(
            messages = chatMessages,
            sending = chatSending,
            error = chatError,
            pendingImages = pendingImages,
            voiceState = voiceState,
            onClose = { aiOpen = false },
            onPickImage = {
                chatError = null
                pickChatImage.launch(
                    androidx.activity.result.PickVisualMediaRequest(
                        ActivityResultContracts.PickVisualMedia.ImageOnly,
                    ),
                )
            },
            onTakePhoto = {
                chatError = null
                val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.CAMERA,
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                if (granted) launchTakePhoto(context, takeChatPhoto) { pendingCameraUri = it }
                else requestCameraPerm.launch(android.Manifest.permission.CAMERA)
            },
            onRemovePendingImage = { idx ->
                pendingImages = pendingImages.toMutableList().also { it.removeAt(idx) }
            },
            onToggleVoice = {
                chatError = null
                when (voiceState) {
                    VoiceUiState.Idle -> {
                        val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                            context, android.Manifest.permission.RECORD_AUDIO,
                        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                        if (granted) {
                            if (voiceRecorder.start()) voiceState = VoiceUiState.Recording
                            else chatError = "No se pudo iniciar la grabación"
                        } else {
                            requestMicPerm.launch(android.Manifest.permission.RECORD_AUDIO)
                        }
                    }
                    VoiceUiState.Recording -> {
                        voiceState = VoiceUiState.Transcribing
                        scope.launch {
                            val text = voiceRecorder.stopAndTranscribe(baseUrl, tokenProvider(), "es")
                            voiceState = VoiceUiState.Idle
                            if (!text.isNullOrBlank()) {
                                sendChatMessage(
                                    text = text,
                                    images = pendingImages,
                                    onClear = { pendingImages = emptyList() },
                                    chatClient = chatClient,
                                    state = ChatSendState(
                                        getMessages = { chatMessages },
                                        setMessages = { chatMessages = it },
                                        setSending = { chatSending = it },
                                        setError = { chatError = it },
                                        onRefresh = onRefresh,
                                        scope = scope,
                                    ),
                                )
                            } else {
                                chatError = "No se pudo transcribir el audio"
                            }
                        }
                    }
                    VoiceUiState.Transcribing -> { /* ignorar */ }
                }
            },
            onSend = { text, images ->
                sendChatMessage(
                    text = text,
                    images = images,
                    onClear = { pendingImages = emptyList() },
                    chatClient = chatClient,
                    state = ChatSendState(
                        getMessages = { chatMessages },
                        setMessages = { chatMessages = it },
                        setSending = { chatSending = it },
                        setError = { chatError = it },
                        onRefresh = onRefresh,
                        scope = scope,
                    ),
                )
            },
        )
    }
}

private data class ChatSendState(
    val getMessages: () -> List<ChatBubble>,
    val setMessages: (List<ChatBubble>) -> Unit,
    val setSending: (Boolean) -> Unit,
    val setError: (String?) -> Unit,
    val onRefresh: () -> Unit,
    val scope: kotlinx.coroutines.CoroutineScope,
)

private fun sendChatMessage(
    text: String,
    images: List<String>,
    onClear: () -> Unit,
    chatClient: ChatClient,
    state: ChatSendState,
) {
    if (text.isBlank() && images.isEmpty()) return
    val userMsg = UiChatMessage(role = "user", text = text, imageDataUrls = images)
    val pendingAssistant = ChatBubble(role = "assistant", text = "", streaming = true)
    val userBubble = ChatBubble(role = "user", text = text, imageDataUrls = images)
    state.setMessages(state.getMessages() + userBubble + pendingAssistant)
    onClear()
    state.setSending(true)
    state.setError(null)
    state.scope.launch {
        var refreshNeeded = false
        try {
            val history = state.getMessages()
                .dropLast(2) // quitar el bubble de usuario recién añadido y el placeholder
                .map { UiChatMessage(role = it.role, text = it.text, imageDataUrls = it.imageDataUrls) }
            val toSend = history + userMsg
            chatClient.stream(toSend).collect { ev ->
                when (ev) {
                    is ChatStreamEvent.TextDelta -> {
                        val list = state.getMessages().toMutableList()
                        val idx = list.lastIndex
                        val cur = list[idx]
                        list[idx] = cur.copy(text = cur.text + ev.delta)
                        state.setMessages(list)
                    }
                    is ChatStreamEvent.ToolResult -> {
                        if (ev.toolName in setOf("createEvent", "updateEvent", "deleteEvent")) {
                            refreshNeeded = true
                        }
                    }
                    is ChatStreamEvent.Error -> state.setError(ev.message)
                    ChatStreamEvent.Finish -> { /* nada */ }
                }
            }
        } catch (e: Exception) {
            state.setError(e.message ?: "Error de red")
        } finally {
            val list = state.getMessages().toMutableList()
            if (list.isNotEmpty()) {
                val idx = list.lastIndex
                list[idx] = list[idx].copy(streaming = false)
                state.setMessages(list)
            }
            state.setSending(false)
            if (refreshNeeded) state.onRefresh()
        }
    }
}

private fun launchTakePhoto(
    context: android.content.Context,
    launcher: androidx.activity.result.ActivityResultLauncher<Uri>,
    onUri: (Uri) -> Unit,
) {
    try {
        val file = java.io.File.createTempFile("photo_", ".jpg", context.cacheDir)
        val uri = androidx.core.content.FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
        onUri(uri)
        launcher.launch(uri)
    } catch (_: Exception) {
        // sin acción
    }
}

@Composable
private fun Header(
    mode: CalendarMode,
    month: YearMonth,
    selectedDate: LocalDate,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onMenu: () -> Unit,
    menuOpen: Boolean,
    onMenuDismiss: () -> Unit,
    onRefresh: () -> Unit,
    onSyncReminders: () -> Unit,
    onLogout: () -> Unit,
    onChangeBackground: () -> Unit,
    onResetBackground: () -> Unit,
    onTestNotification: () -> Unit,
    onGrantExactAlarms: (() -> Unit)?,
) {
    val title = when (mode) {
        CalendarMode.Month -> month.format(CalendarUtils.MONTH_FORMAT).replaceFirstChar { it.titlecase() }
        CalendarMode.Week -> {
            val days = CalendarUtils.weekOf(selectedDate)
            "${days.first().dayOfMonth} ${monthShort(days.first().monthValue)} – ${days.last().dayOfMonth} ${monthShort(days.last().monthValue)}"
        }
        CalendarMode.Day -> selectedDate.format(CalendarUtils.DAY_HEADER_FORMAT).replaceFirstChar { it.titlecase() }
    }

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(primaryGradient()),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.size(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("DVGCalendar", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(title, color = DvgColors.Sky300, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        IconButton(onClick = onPrev) { Icon(Icons.Default.ChevronLeft, contentDescription = "Anterior", tint = DvgColors.White80) }
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, contentDescription = "Siguiente", tint = DvgColors.White80) }
        Box {
            IconButton(onClick = onMenu) {
                Icon(Icons.Default.MoreVert, contentDescription = "Menú", tint = DvgColors.White80)
            }
            DropdownMenu(
                expanded = menuOpen,
                onDismissRequest = onMenuDismiss,
                modifier = Modifier.background(DvgColors.Slate900),
            ) {
                DropdownMenuItem(
                    text = { Text("Recargar eventos", color = DvgColors.White88) },
                    leadingIcon = { Icon(Icons.Default.Refresh, null, tint = DvgColors.White80) },
                    onClick = onRefresh,
                )
                DropdownMenuItem(
                    text = { Text("Sincronizar recordatorios", color = DvgColors.White88) },
                    leadingIcon = { Icon(Icons.Default.NotificationsActive, null, tint = DvgColors.Sky400) },
                    onClick = onSyncReminders,
                )
                DropdownMenuItem(
                    text = { Text("Probar notificación", color = DvgColors.White88) },
                    leadingIcon = { Icon(Icons.Default.Bolt, null, tint = DvgColors.Violet400) },
                    onClick = onTestNotification,
                )
                if (onGrantExactAlarms != null) {
                    DropdownMenuItem(
                        text = { Text("Permitir alarmas exactas", color = DvgColors.White88) },
                        leadingIcon = { Icon(Icons.Default.AlarmOn, null, tint = Color(0xFFFBBF24)) },
                        onClick = onGrantExactAlarms,
                    )
                }
                DropdownMenuItem(
                    text = { Text("Cambiar fondo…", color = DvgColors.White88) },
                    leadingIcon = { Icon(Icons.Default.PhotoLibrary, null, tint = DvgColors.Violet400) },
                    onClick = onChangeBackground,
                )
                DropdownMenuItem(
                    text = { Text("Restablecer fondo", color = DvgColors.White88) },
                    leadingIcon = { Icon(Icons.Default.RestartAlt, null, tint = DvgColors.White65) },
                    onClick = onResetBackground,
                )
                DropdownMenuItem(
                    text = { Text("Cerrar sesión", color = Color(0xFFFCA5A5)) },
                    leadingIcon = { Icon(Icons.AutoMirrored.Filled.Logout, null, tint = Color(0xFFFCA5A5)) },
                    onClick = onLogout,
                )
            }
        }
    }
}

@Composable
private fun FabPrimary(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(DvgColors.Sky500)
            .border(2.dp, Color.White.copy(alpha = 0.25f), CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = Color.White)
    }
}

@Composable
private fun FabSecondary(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(CircleShape)
            .background(primaryGradient())
            .border(2.dp, Color.White.copy(alpha = 0.25f), CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = Color.White, modifier = Modifier.size(22.dp))
    }
}

private fun monthShort(m: Int): String = when (m) {
    1 -> "ene"; 2 -> "feb"; 3 -> "mar"; 4 -> "abr"; 5 -> "may"; 6 -> "jun"
    7 -> "jul"; 8 -> "ago"; 9 -> "sep"; 10 -> "oct"; 11 -> "nov"; 12 -> "dic"
    else -> ""
}
