package com.calendario2.mobile

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.calendario2.mobile.data.CalendarioApi
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.data.LoginBody
import com.calendario2.mobile.data.TokenHolder
import com.calendario2.mobile.data.TokenStore
import com.calendario2.mobile.notifications.ReminderReceiver
import com.calendario2.mobile.notifications.ReminderScheduler
import com.calendario2.mobile.notifications.SyncRemindersWorker
import com.calendario2.mobile.ui.calendar.CalendarScreen
import com.calendario2.mobile.ui.components.AppBackground
import com.calendario2.mobile.ui.components.glassInset
import com.calendario2.mobile.ui.components.glassPanel
import com.calendario2.mobile.ui.components.primaryGradient
import com.calendario2.mobile.ui.theme.CalendarioTheme
import com.calendario2.mobile.ui.theme.DvgColors
import kotlinx.coroutines.launch
import java.time.LocalDate

class MainActivity : ComponentActivity() {

    private val requestNotifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* opcional: reintentar sync */ }

    /** Fecha inicial pasada por la notificación al abrir la app. */
    private var pendingInitialDate by mutableStateOf<LocalDate?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        consumeReminderIntent(intent)

        val tokenStore = TokenStore(applicationContext)
        val api = CalendarioApi.create(BuildConfig.API_BASE_URL) { TokenHolder.token }

        setContent {
            CalendarioTheme {
                var loggedIn by remember { mutableStateOf(TokenHolder.token != null) }
                var events by remember { mutableStateOf<List<EventDto>>(emptyList()) }
                var loading by remember { mutableStateOf(false) }
                var error by remember { mutableStateOf<String?>(null) }
                val scope = rememberCoroutineScope()
                val lifecycleOwner = LocalLifecycleOwner.current

                LaunchedEffect(Unit) {
                    tokenStore.loadToken()
                    loggedIn = TokenHolder.token != null
                    if (loggedIn) {
                        loading = true
                        try {
                            events = api.events().events
                        } catch (e: Exception) {
                            error = friendlyError(e)
                        } finally {
                            loading = false
                        }
                    }
                }

                // Reprograma alarmas cada vez que cambia la lista de eventos.
                LaunchedEffect(events) {
                    if (loggedIn && events.isNotEmpty()) {
                        ReminderScheduler.rescheduleAll(this@MainActivity, events)
                    }
                }

                fun loadEvents() {
                    if (!loggedIn) return
                    scope.launch {
                        loading = true
                        error = null
                        try {
                            events = api.events().events
                        } catch (e: Exception) {
                            error = friendlyError(e)
                        } finally {
                            loading = false
                        }
                    }
                }

                // Refresh automático al volver a primer plano.
                DisposableEffect(lifecycleOwner, loggedIn) {
                    val observer = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME && loggedIn) {
                            loadEvents()
                        }
                    }
                    lifecycleOwner.lifecycle.addObserver(observer)
                    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
                }

                AppBackground {
                    if (!loggedIn) {
                        LoginScreen(
                            loading = loading,
                            error = error,
                            onLogin = { email, pass ->
                                scope.launch {
                                    loading = true
                                    error = null
                                    try {
                                        TokenHolder.token = null
                                        val res = api.login(LoginBody(email, pass))
                                        tokenStore.saveToken(res.token)
                                        loggedIn = true
                                        events = api.events().events
                                        SyncRemindersWorker.enqueue(this@MainActivity)
                                    } catch (e: Exception) {
                                        error = friendlyError(e)
                                    } finally {
                                        loading = false
                                    }
                                }
                            },
                        )
                    } else {
                        CalendarScreen(
                            api = api,
                            baseUrl = BuildConfig.API_BASE_URL,
                            tokenProvider = { TokenHolder.token },
                            events = events,
                            loading = loading,
                            error = error,
                            initialDate = pendingInitialDate,
                            onInitialDateConsumed = { pendingInitialDate = null },
                            onRefresh = { loadEvents() },
                            onSyncReminders = {
                                ReminderScheduler.rescheduleAll(this@MainActivity, events)
                            },
                            onLogout = {
                                scope.launch {
                                    tokenStore.saveToken(null)
                                    ReminderScheduler.cancelAll(this@MainActivity)
                                    SyncRemindersWorker.cancel(this@MainActivity)
                                    loggedIn = false
                                    events = emptyList()
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        consumeReminderIntent(intent)
    }

    private fun consumeReminderIntent(intent: Intent?) {
        val dateStr = intent?.getStringExtra(ReminderReceiver.EXTRA_EVENT_DATE) ?: return
        try {
            pendingInitialDate = LocalDate.parse(dateStr)
        } catch (_: Exception) { /* fecha inválida: ignorar */ }
    }
}

internal fun friendlyError(e: Exception): String {
    val raw = e.message.orEmpty()
    return when {
        raw.contains("401") || raw.contains("Credenciales", ignoreCase = true) ->
            "Credenciales incorrectas"
        raw.contains("Unable to resolve host", ignoreCase = true) ||
            raw.contains("failed to connect", ignoreCase = true) ->
            "Sin conexión con el servidor"
        raw.isBlank() -> "No se pudo iniciar sesión"
        else -> raw
    }
}

@Composable
private fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(primaryGradient()),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.White)
        }
        Spacer(Modifier.height(18.dp))
        Text(text = "DVGCalendar", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Recordatorios inteligentes día con día",
            color = DvgColors.Sky300,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(28.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 420.dp)
                .glassPanel()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GlassTextField(value = email, onValueChange = { email = it }, label = "Correo")
            GlassTextField(value = password, onValueChange = { password = it }, label = "Contraseña", isPassword = true)

            error?.let {
                Text(text = it, color = Color(0xFFFCA5A5), fontSize = 13.sp)
            }

            Spacer(Modifier.height(4.dp))
            GradientButton(
                text = if (loading) "Entrando…" else "Entrar",
                enabled = !loading && email.isNotBlank() && password.isNotBlank(),
                loading = loading,
                onClick = { onLogin(email.trim(), password) },
            )
        }
    }
}

@Composable
private fun GlassTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    isPassword: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = DvgColors.White55) },
        singleLine = true,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier
            .fillMaxWidth()
            .glassInset(),
        shape = RoundedCornerShape(14.dp),
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
private fun GradientButton(
    text: String,
    enabled: Boolean,
    loading: Boolean,
    onClick: () -> Unit,
) {
    val alpha = if (enabled) 1f else 0.45f
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(primaryGradient())
            .let { if (enabled) it.clickable { onClick() } else it }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = Color.White,
                strokeWidth = 2.dp,
            )
        } else {
            Text(text = text, color = Color.White.copy(alpha = alpha), fontWeight = FontWeight.SemiBold)
        }
    }
}
