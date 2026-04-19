package com.calendario2.mobile.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.calendario2.mobile.MainActivity
import com.calendario2.mobile.R

/**
 * Helpers para acciones rápidas relacionadas con notificaciones desde la UI.
 */
object NotificationActions {

    /**
     * Abre la pantalla del sistema para conceder el permiso "Alarmas y
     * recordatorios" en Android 12+ (necesario para que las alarmas exactas
     * funcionen aunque la pantalla esté apagada).
     */
    fun openExactAlarmSettings(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            // Algunos OEMs no soportan el deep link directo
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                },
            )
        }
    }

    /**
     * Lanza una notificación de prueba inmediata para verificar canal,
     * permiso y estilos.
     */
    fun fireTestNotification(context: Context) {
        ReminderNotifications.ensureChannel(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pi = PendingIntent.getActivity(context, 9_999, openIntent, piFlags)

        val notification = NotificationCompat.Builder(context, ReminderNotifications.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF0ea5e9.toInt())
            .setColorized(true)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText("Prueba: las notificaciones funcionan correctamente.")
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "Si ves esto, el canal y el permiso están bien.\n" +
                        "Los recordatorios reales saltarán automáticamente para tus eventos.",
                ),
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(9_999, notification)
        } catch (_: SecurityException) {
            // Sin permiso POST_NOTIFICATIONS
        }
    }
}
