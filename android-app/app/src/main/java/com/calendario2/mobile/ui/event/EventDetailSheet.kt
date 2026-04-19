package com.calendario2.mobile.ui.event

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.ui.calendar.CalendarUtils
import com.calendario2.mobile.ui.theme.DvgColors
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Vista detalle del evento. Replica la "tarjeta" usada en los correos
 * de Resend (`lib/email.ts > eventBlock`): barra de acento + filas con
 * iconos · / ◷ / ⌖ + descripción al pie.
 */
@Composable
fun EventDetailSheet(
    event: EventDto,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onClose: () -> Unit,
) {
    val accent = CalendarUtils.accentHexForColor(event.color)
    val dateLabel = formatLongDate(event.eventDate)
    val laneLabel = CalendarUtils.laneLabel(event.color)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
            .clickable { onClose() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(Color(0xFFf8fafc))
                .clickable(enabled = false) {}
                .padding(bottom = 18.dp),
        ) {
            // Hero con gradiente del color del evento
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            listOf(accent, accent.copy(alpha = 0.7f)),
                        ),
                    )
                    .padding(horizontal = 22.dp, vertical = 22.dp),
            ) {
                Column {
                    Text(
                        text = laneLabel.uppercase(),
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = event.title,
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            // Tarjeta blanca con filas de iconos (igual que el email)
            Column(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFe2e8f0), RoundedCornerShape(14.dp))
                    .padding(horizontal = 18.dp, vertical = 16.dp),
            ) {
                DetailRow(icon = { Bullet(accent) }, text = dateLabel)
                DetailRow(
                    icon = { Icon(Icons.Default.AccessTime, null, tint = accent, modifier = Modifier.size(18.dp)) },
                    text = "${event.startTime} – ${event.endTime}",
                )
                if (!event.location.isNullOrBlank()) {
                    DetailRow(
                        icon = { Icon(Icons.Default.LocationOn, null, tint = accent, modifier = Modifier.size(18.dp)) },
                        text = event.location,
                    )
                }
                DetailRow(
                    icon = { Icon(Icons.Outlined.CalendarMonth, null, tint = accent, modifier = Modifier.size(18.dp)) },
                    text = laneLabel,
                )
                DetailRow(
                    icon = {
                        Icon(
                            if (event.emailRemindersEnabled == false) Icons.Default.NotificationsOff
                            else Icons.Default.NotificationsActive,
                            null,
                            tint = accent,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    text = reminderLabel(event),
                )

                if (!event.description.isNullOrBlank()) {
                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFe2e8f0))
                            .height(1.dp),
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = event.description,
                        color = Color(0xFF475569),
                        fontSize = 13.sp,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            Row(
                modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ActionButton(
                    text = "Editar",
                    icon = Icons.Default.Edit,
                    background = Brush.linearGradient(listOf(accent, accent.copy(alpha = 0.7f))),
                    onClick = onEdit,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFfee2e2))
                        .clickable { onDelete() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = Color(0xFFdc2626))
                }
            }
        }
    }
}

@Composable
private fun DetailRow(icon: @Composable () -> Unit, text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.width(22.dp), contentAlignment = Alignment.Center) { icon() }
        Spacer(Modifier.width(10.dp))
        Text(text = text, color = Color(0xFF334155), fontSize = 14.sp)
    }
}

@Composable
private fun Bullet(color: Color) {
    Box(
        modifier = Modifier.size(10.dp).clip(CircleShape).background(color),
    )
}

@Composable
private fun ActionButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    background: Brush,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .clickable { onClick() }
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

private fun reminderLabel(event: EventDto): String {
    if (event.emailRemindersEnabled == false) return "Recordatorios por correo desactivados"
    val m = event.reminderMinutesBefore
    val base = "Aviso el día del evento (~8:00)"
    if (m == null) return base
    val extra = when {
        m >= 1440 -> if (m / 1440 == 1) " · 1 día antes" else " · ${m / 1440} días antes"
        m >= 60 -> if (m / 60 == 1) " · 1 hora antes" else " · ${m / 60} horas antes"
        else -> " · $m min antes"
    }
    return base + extra
}

private fun formatLongDate(iso: String): String {
    if (!iso.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) return iso
    val date = try { LocalDate.parse(iso) } catch (_: Exception) { return iso }
    val s = date.format(DateTimeFormatter.ofPattern("EEEE d 'de' LLLL 'de' yyyy", Locale("es")))
    return s.replaceFirstChar { it.titlecase(Locale("es")) }
}
