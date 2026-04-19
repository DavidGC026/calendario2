package com.calendario2.mobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.calendario2.mobile.BuildConfig
import com.calendario2.mobile.data.CalendarioApi
import com.calendario2.mobile.data.TokenHolder
import com.calendario2.mobile.data.TokenStore
import kotlinx.coroutines.runBlocking

/**
 * Tras reiniciar el teléfono, vuelve a programar alarmas si hay sesión guardada.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val pending = goAsync()
        Thread {
            try {
                val app = context.applicationContext
                val store = TokenStore(app)
                val token = runBlocking { store.loadToken() }
                if (token == null) return@Thread
                TokenHolder.token = token
                val api = CalendarioApi.create(BuildConfig.API_BASE_URL) { TokenHolder.token }
                val events = runBlocking { api.events() }.events
                ReminderScheduler.rescheduleAll(app, events)
            } catch (_: Exception) {
                // Silencioso: sin red o token inválido
            } finally {
                pending.finish()
            }
        }.start()
    }
}
