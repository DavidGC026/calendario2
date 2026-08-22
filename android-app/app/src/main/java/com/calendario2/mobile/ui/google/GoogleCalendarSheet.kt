package com.calendario2.mobile.ui.google

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LinkOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.data.GoogleCalendarStatus
import com.calendario2.mobile.ui.theme.DvgColors

/**
 * Google Calendar, visto desde el teléfono.
 *
 * Quien sincroniza es el servidor, cada pocos minutos: el teléfono no habla con
 * Google ni guarda credenciales suyas. Aquí solo se hacen tres cosas —conectar,
 * empujar una pasada ahora y desconectar— y, sobre todo, se ENSEÑA SI FUNCIONA.
 *
 * Eso último es la razón de que esta pantalla exista. Una sincronización rota no
 * se nota: el calendario sigue lleno de eventos y todo parece bien hasta que
 * falta una cita. Por eso se enseñan siempre la última pasada correcta y el
 * último fallo, en vez de un «conectado» que puede llevar tres semanas mintiendo.
 *
 * Conectar abre el navegador y no una pantalla propia: el permiso lo concede
 * Google en su dominio, con la barra de direcciones a la vista. Meter eso en un
 * WebView dentro de la app es justo lo que enseña a la gente a escribir su
 * contraseña de Google en cualquier parte.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun GoogleCalendarSheet(
    status: GoogleCalendarStatus?,
    loading: Boolean,
    syncing: Boolean,
    message: String?,
    error: String?,
    onConnect: (String) -> Unit,
    onSyncNow: () -> Unit,
    onDisconnect: () -> Unit,
    onClose: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onClose,
        containerColor = DvgColors.Slate900,
        contentColor = DvgColors.White88,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CalendarMonth, null, tint = DvgColors.Gold400, modifier = Modifier.size(20.dp))
                Spacer(Modifier.size(8.dp))
                Text("Google Calendar", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.size(6.dp))
            Text(
                "Tus eventos se sincronizan en los dos sentidos. Lo hace el servidor cada pocos minutos; " +
                    "el teléfono no necesita estar abierto.",
                color = DvgColors.White55,
                fontSize = 12.sp,
            )
            Spacer(Modifier.size(16.dp))

            when {
                loading -> Text("…", color = DvgColors.White45, fontSize = 14.sp)

                status?.configured == false -> Text(
                    "El servidor no tiene configurado Google.",
                    color = DvgColors.White45,
                    fontSize = 13.sp,
                )

                status?.link == null -> {
                    val url = status?.connectUrl
                    Button(
                        onClick = { url?.let(onConnect) },
                        enabled = url != null,
                        colors = ButtonDefaults.buttonColors(containerColor = DvgColors.BrandRed),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Conectar con Google")
                    }
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Se abre el navegador para dar el permiso en Google. Al terminar, vuelve a la app.",
                        color = DvgColors.White45,
                        fontSize = 11.sp,
                    )
                }

                else -> {
                    val link = status.link
                    Column(
                        Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(DvgColors.White15.copy(alpha = 0.06f))
                            .padding(12.dp),
                    ) {
                        Text(link.googleEmail.ifBlank { link.calendarId }, color = DvgColors.White88, fontSize = 14.sp)
                        Spacer(Modifier.size(2.dp))
                        Text(
                            "Última sincronización: " + (link.lastSyncAt?.let(::readableInstant) ?: "todavía ninguna"),
                            color = DvgColors.White45,
                            fontSize = 11.sp,
                        )
                    }

                    if (!link.syncEnabled) {
                        Spacer(Modifier.size(10.dp))
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.WarningAmber, null, tint = DvgColors.Gold400, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.size(6.dp))
                            Text(
                                "Sincronización detenida: Google retiró el permiso. Vuelve a conectar.",
                                color = DvgColors.Gold300,
                                fontSize = 12.sp,
                            )
                        }
                    }

                    link.lastError?.let {
                        Spacer(Modifier.size(8.dp))
                        Text(it, color = Color(0xFFFCA5A5), fontSize = 12.sp)
                    }

                    Spacer(Modifier.size(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onSyncNow,
                            enabled = !syncing,
                            colors = ButtonDefaults.buttonColors(containerColor = DvgColors.BrandRed),
                        ) {
                            if (syncing) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                            } else {
                                Icon(Icons.Default.Sync, null, modifier = Modifier.size(16.dp))
                            }
                            Spacer(Modifier.size(8.dp))
                            Text(if (syncing) "Sincronizando…" else "Sincronizar ahora")
                        }
                        status.connectUrl?.let { url ->
                            TextButton(onClick = { onConnect(url) }) {
                                Text("Reconectar", color = DvgColors.White65)
                            }
                        }
                    }

                    Spacer(Modifier.size(4.dp))
                    TextButton(onClick = onDisconnect) {
                        Icon(Icons.Default.LinkOff, null, tint = Color(0xFFFCA5A5), modifier = Modifier.size(16.dp))
                        Spacer(Modifier.size(6.dp))
                        Text("Desconectar", color = Color(0xFFFCA5A5))
                    }
                    Text(
                        "Los eventos que ya se bajaron se quedan en tu calendario.",
                        color = DvgColors.White35,
                        fontSize = 11.sp,
                    )
                }
            }

            message?.let {
                Spacer(Modifier.size(10.dp))
                Text(it, color = DvgColors.Gold300, fontSize = 12.sp)
            }
            error?.let {
                Spacer(Modifier.size(10.dp))
                Text(it, color = Color(0xFFFCA5A5), fontSize = 12.sp)
            }
        }
    }
}

/** "2026-08-21T22:31:00.000Z" → "21/08 22:31". Sin librerías: es una etiqueta. */
private fun readableInstant(iso: String): String = runCatching {
    val t = java.time.Instant.parse(iso).atZone(java.time.ZoneId.systemDefault())
    "%02d/%02d %02d:%02d".format(t.dayOfMonth, t.monthValue, t.hour, t.minute)
}.getOrDefault(iso)
