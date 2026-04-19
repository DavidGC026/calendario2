package com.calendario2.mobile.ui.event

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.ui.calendar.CalendarUtils
import com.calendario2.mobile.ui.calendar.Lane
import com.calendario2.mobile.ui.components.glassInset
import com.calendario2.mobile.ui.components.primaryGradient
import com.calendario2.mobile.ui.theme.DvgColors
import java.time.LocalDate
import java.time.LocalTime

private val REMINDER_OPTIONS = listOf<Pair<Int?, String>>(
    null to "Sin aviso extra",
    5 to "5 minutos antes",
    15 to "15 minutos antes",
    30 to "30 minutos antes",
    60 to "1 hora antes",
    120 to "2 horas antes",
    1440 to "1 día antes",
)

data class EventDraft(
    val id: String? = null,
    val title: String = "",
    val date: LocalDate = LocalDate.now(),
    val start: LocalTime = LocalTime.of(9, 0),
    val end: LocalTime = LocalTime.of(10, 0),
    val location: String = "",
    val description: String = "",
    val color: String = "bg-blue-500",
    val reminderMinutes: Int? = null,
    val emailRemindersEnabled: Boolean = true,
)

fun EventDto.toDraft(): EventDraft = EventDraft(
    id = id,
    title = title,
    date = LocalDate.parse(eventDate),
    start = LocalTime.parse(startTime),
    end = LocalTime.parse(endTime),
    location = location.orEmpty(),
    description = description.orEmpty(),
    color = color ?: "bg-blue-500",
    reminderMinutes = reminderMinutesBefore,
    emailRemindersEnabled = emailRemindersEnabled ?: true,
)

@Composable
fun EventSheet(
    initial: EventDraft,
    saving: Boolean,
    error: String?,
    onSave: (EventDraft) -> Unit,
    onDelete: (() -> Unit)?,
    onClose: () -> Unit,
) {
    var draft by remember(initial.id) { mutableStateOf(initial) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
            .clickable(enabled = !saving) { onClose() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(DvgColors.Slate950.copy(alpha = 0.98f))
                .border(
                    width = 1.dp,
                    color = DvgColors.White15,
                    shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
                )
                .clickable(enabled = false) {}
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .size(width = 38.dp, height = 4.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(DvgColors.White15),
            )
            Spacer(Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (draft.id != null) "Editar evento" else "Nuevo evento",
                    color = DvgColors.White95,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onClose, enabled = !saving) {
                    Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = DvgColors.White65)
                }
            }

            LazyColumn(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                item {
                    GlassField(
                        value = draft.title,
                        onValueChange = { draft = draft.copy(title = it) },
                        label = "Título",
                    )
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DateButton(
                            label = "Fecha",
                            date = draft.date,
                            modifier = Modifier.weight(1f),
                        ) { newDate ->
                            draft = draft.copy(date = newDate)
                        }
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TimeButton(
                            label = "Inicio",
                            time = draft.start,
                            modifier = Modifier.weight(1f),
                        ) { t ->
                            draft = draft.copy(start = t)
                        }
                        TimeButton(
                            label = "Fin",
                            time = draft.end,
                            modifier = Modifier.weight(1f),
                        ) { t ->
                            draft = draft.copy(end = t)
                        }
                    }
                }
                item { LaneSelector(draft.color) { draft = draft.copy(color = it) } }
                item {
                    GlassField(
                        value = draft.location,
                        onValueChange = { draft = draft.copy(location = it) },
                        label = "Ubicación (opcional)",
                    )
                }
                item {
                    GlassField(
                        value = draft.description,
                        onValueChange = { draft = draft.copy(description = it) },
                        label = "Descripción (opcional)",
                        minLines = 2,
                    )
                }
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .glassInset()
                            .padding(12.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = draft.emailRemindersEnabled,
                                onCheckedChange = { v ->
                                    draft = draft.copy(
                                        emailRemindersEnabled = v,
                                        reminderMinutes = if (v) draft.reminderMinutes else null,
                                    )
                                },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = DvgColors.Sky500,
                                    uncheckedColor = DvgColors.White45,
                                ),
                            )
                            Text(
                                "Recibir recordatorios por correo (día del evento ~8:00 y aviso previo)",
                                color = DvgColors.White88,
                                fontSize = 12.sp,
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text("Aviso adicional antes del inicio", color = DvgColors.White55, fontSize = 11.sp)
                        Spacer(Modifier.height(4.dp))
                        ReminderChips(
                            current = draft.reminderMinutes,
                            enabled = draft.emailRemindersEnabled,
                        ) { v -> draft = draft.copy(reminderMinutes = v) }
                    }
                }
                if (error != null) {
                    item {
                        Text(error, color = Color(0xFFFCA5A5), fontSize = 12.sp)
                    }
                }
                item { Spacer(Modifier.height(8.dp)) }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (onDelete != null) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(Color(0x33ef4444))
                            .clickable(enabled = !saving) { showDeleteConfirm = true },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = Color(0xFFFCA5A5))
                    }
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(primaryGradient())
                        .clickable(enabled = !saving && draft.title.isNotBlank()) { onSave(draft) },
                    contentAlignment = Alignment.Center,
                ) {
                    if (saving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text(
                            text = if (draft.id != null) "Guardar cambios" else "Crear evento",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }

    if (showDeleteConfirm && onDelete != null) {
        ConfirmDialog(
            text = "¿Eliminar este evento? Se notificará a los participantes por correo.",
            onConfirm = {
                showDeleteConfirm = false
                onDelete()
            },
            onDismiss = { showDeleteConfirm = false },
        )
    }
}

@Composable
private fun GlassField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    minLines: Int = 1,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = DvgColors.White55) },
        minLines = minLines,
        singleLine = minLines == 1,
        modifier = Modifier.fillMaxWidth().glassInset(),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = DvgColors.White95,
            unfocusedTextColor = DvgColors.White95,
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            focusedBorderColor = DvgColors.Sky400.copy(alpha = 0.7f),
            unfocusedBorderColor = Color.Transparent,
            focusedLabelColor = DvgColors.Sky300,
            unfocusedLabelColor = DvgColors.White55,
            cursorColor = DvgColors.Sky400,
        ),
    )
}

@Composable
private fun DateButton(
    label: String,
    date: LocalDate,
    modifier: Modifier = Modifier,
    onPick: (LocalDate) -> Unit,
) {
    val context = LocalContext.current
    Box(
        modifier = modifier
            .glassInset()
            .clickable {
                DatePickerDialog(
                    context,
                    { _, y, m, d -> onPick(LocalDate.of(y, m + 1, d)) },
                    date.year, date.monthValue - 1, date.dayOfMonth,
                ).show()
            }
            .padding(12.dp),
    ) {
        Column {
            Text(label, color = DvgColors.White55, fontSize = 11.sp)
            Spacer(Modifier.height(2.dp))
            Text(date.toString(), color = DvgColors.White95, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun TimeButton(
    label: String,
    time: LocalTime,
    modifier: Modifier = Modifier,
    onPick: (LocalTime) -> Unit,
) {
    val context = LocalContext.current
    Box(
        modifier = modifier
            .glassInset()
            .clickable {
                TimePickerDialog(
                    context,
                    { _, h, m -> onPick(LocalTime.of(h, m)) },
                    time.hour, time.minute, true,
                ).show()
            }
            .padding(12.dp),
    ) {
        Column {
            Text(label, color = DvgColors.White55, fontSize = 11.sp)
            Spacer(Modifier.height(2.dp))
            Text("%02d:%02d".format(time.hour, time.minute), color = DvgColors.White95, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun LaneSelector(current: String, onSelect: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().glassInset().padding(12.dp)) {
        Text("Calendario", color = DvgColors.White55, fontSize = 11.sp)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CalendarUtils.LANES.forEach { lane: Lane ->
                val active = lane.colorClass == current
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (active) lane.accent.copy(alpha = 0.30f) else DvgColors.White5,
                        )
                        .border(
                            width = if (active) 1.5.dp else 1.dp,
                            color = if (active) lane.accent else DvgColors.White15,
                            shape = RoundedCornerShape(10.dp),
                        )
                        .clickable { onSelect(lane.colorClass) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(lane.accent),
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            lane.label,
                            color = if (active) Color.White else DvgColors.White65,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReminderChips(
    current: Int?,
    enabled: Boolean,
    onSelect: (Int?) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val visible = REMINDER_OPTIONS.take(4) // 4 chips visibles por línea
        visible.forEach { (value, label) ->
            val active = current == value
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (active) DvgColors.Sky500.copy(alpha = 0.3f) else DvgColors.White5)
                    .border(
                        width = 1.dp,
                        color = if (active) DvgColors.Sky400 else DvgColors.White15,
                        shape = RoundedCornerShape(10.dp),
                    )
                    .clickable(enabled = enabled) { onSelect(value) }
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = shortLabel(value),
                    color = if (active) Color.White else if (enabled) DvgColors.White80 else DvgColors.White35,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        REMINDER_OPTIONS.drop(4).forEach { (value, _) ->
            val active = current == value
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (active) DvgColors.Sky500.copy(alpha = 0.3f) else DvgColors.White5)
                    .border(
                        width = 1.dp,
                        color = if (active) DvgColors.Sky400 else DvgColors.White15,
                        shape = RoundedCornerShape(10.dp),
                    )
                    .clickable(enabled = enabled) { onSelect(value) }
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = shortLabel(value),
                    color = if (active) Color.White else if (enabled) DvgColors.White80 else DvgColors.White35,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun shortLabel(v: Int?): String = when (v) {
    null -> "Sin extra"
    5 -> "5 min"
    15 -> "15 min"
    30 -> "30 min"
    60 -> "1 h"
    120 -> "2 h"
    1440 -> "1 día"
    else -> "${v}m"
}

@Composable
private fun ConfirmDialog(text: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = onConfirm) {
                Text("Eliminar", color = Color(0xFFFCA5A5))
            }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) {
                Text("Cancelar", color = DvgColors.White80)
            }
        },
        text = { Text(text, color = DvgColors.White80) },
        containerColor = DvgColors.Slate900,
    )
}
