package com.calendario2.mobile.notifications

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.calendario2.mobile.MainActivity
import com.calendario2.mobile.R

class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: context.getString(R.string.app_name)
        val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
        val eventId = intent?.getStringExtra(EXTRA_EVENT_ID)
        val eventDate = intent?.getStringExtra(EXTRA_EVENT_DATE)
        val color = intent?.getStringExtra(EXTRA_EVENT_COLOR)

        ReminderNotifications.ensureChannel(context)

        val notifyId = intent?.getIntExtra(EXTRA_NOTIFY_ID, 0)?.takeIf { it != 0 }
            ?: (System.currentTimeMillis() % Int.MAX_VALUE).toInt()

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_EVENT_ID, eventId)
            putExtra(EXTRA_EVENT_DATE, eventDate)
        }
        val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val contentPi = PendingIntent.getActivity(context, notifyId, openIntent, piFlags)

        val accentColor = accentForColor(color)

        val notification = NotificationCompat.Builder(context, ReminderNotifications.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(accentColor)
            .setColorized(true)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(contentPi)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notifyId, notification)
        } catch (_: SecurityException) {
            // Sin permiso POST_NOTIFICATIONS (Android 13+); el usuario aún no aceptó.
        }
    }

    private fun accentForColor(color: String?): Int = when (color) {
        "bg-green-500" -> 0xFF22c55e.toInt()
        "bg-orange-500" -> 0xFFf97316.toInt()
        "bg-purple-500" -> 0xFFa855f7.toInt()
        "bg-pink-500" -> 0xFFec4899.toInt()
        "bg-yellow-500" -> 0xFFeab308.toInt()
        "bg-cyan-500" -> 0xFF06b6d4.toInt()
        "bg-red-500" -> 0xFFef4444.toInt()
        "bg-violet-500" -> 0xFF8b5cf6.toInt()
        else -> 0xFF0ea5e9.toInt() // sky-500
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
        const val EXTRA_NOTIFY_ID = "notify_id"
        const val EXTRA_EVENT_ID = "event_id"
        const val EXTRA_EVENT_DATE = "event_date"
        const val EXTRA_EVENT_COLOR = "event_color"
    }
}
