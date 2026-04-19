package com.calendario2.mobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.calendario2.mobile.R

class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: context.getString(R.string.app_name)
        val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""

        ReminderNotifications.ensureChannel(context)

        val notification = NotificationCompat.Builder(context, ReminderNotifications.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_today)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        val id = intent?.getIntExtra(EXTRA_NOTIFY_ID, 0)?.takeIf { it != 0 }
            ?: (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        NotificationManagerCompat.from(context).notify(id, notification)
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
        const val EXTRA_NOTIFY_ID = "notify_id"
    }
}
