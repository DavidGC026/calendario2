package com.calendario2.mobile.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.calendario2.mobile.data.EventDto
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Programa notificaciones locales alineadas con la app web:
 * - ~8:00 del día del evento (zona horaria del dispositivo)
 * - X minutos antes del inicio si el evento tiene [EventDto.reminderMinutesBefore]
 *
 * Requiere permiso de alarmas exactas en Android 12+.
 */
object ReminderScheduler {

    private const val PREFS = "calendario_alarm_codes"
    private const val KEY_CODES = "codes"

    fun rescheduleAll(context: Context, events: List<EventDto>) {
        cancelAll(context)
        val zone = ZoneId.systemDefault()
        val now = ZonedDateTime.now(zone)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val newCodes = mutableSetOf<String>()

        for (e in events) {
            if (e.emailRemindersEnabled == false) continue
            val start = eventStart(e, zone) ?: continue
            if (!start.isAfter(now)) continue

            // Recordatorio del día (~8:00)
            val morning = LocalDate.parse(e.eventDate).atTime(8, 0).atZone(zone)
            if (morning.isAfter(now)) {
                schedule(
                    context, am, e, "morning", morning,
                    context.getString(com.calendario2.mobile.R.string.app_name),
                    "Hoy: ${e.title}",
                    newCodes,
                )
            }

            val mins = e.reminderMinutesBefore
            if (mins != null && mins > 0) {
                val fire = start.minusMinutes(mins.toLong())
                if (fire.isAfter(now)) {
                    schedule(
                        context, am, e, "advance", fire,
                        e.title,
                        "En $mins min · ${e.title}",
                        newCodes,
                    )
                }
            }
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_CODES, newCodes)
            .apply()
    }

    private fun eventStart(e: EventDto, zone: ZoneId): ZonedDateTime? = try {
        val d = LocalDate.parse(e.eventDate)
        val parts = e.startTime.split(":")
        val h = parts[0].toInt()
        val m = parts[1].toInt()
        d.atTime(h, m).atZone(zone)
    } catch (_: Exception) {
        null
    }

    private fun schedule(
        context: Context,
        am: AlarmManager,
        e: EventDto,
        kind: String,
        whenZ: ZonedDateTime,
        title: String,
        text: String,
        codes: MutableSet<String>,
    ) {
        val rc = requestCode(e.id, kind)
        codes.add("$rc")
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(ReminderReceiver.EXTRA_TITLE, title)
            putExtra(ReminderReceiver.EXTRA_TEXT, text)
            putExtra(ReminderReceiver.EXTRA_NOTIFY_ID, rc)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pi = PendingIntent.getBroadcast(context, rc, intent, flags)
        val trigger = whenZ.toInstant().toEpochMilli()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(trigger, pi), pi)
        } else {
            @Suppress("DEPRECATION")
            am.setExact(AlarmManager.RTC_WAKEUP, trigger, pi)
        }
    }

    private fun requestCode(eventId: String, kind: String): Int =
        (eventId.hashCode() * 31 + kind.hashCode()) and 0x7fff_ff

    fun cancelAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = prefs.getStringSet(KEY_CODES, null) ?: emptySet()
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_NO_CREATE
        }
        for (s in old) {
            val rc = s.toIntOrNull() ?: continue
            val pi = PendingIntent.getBroadcast(
                context,
                rc,
                Intent(context, ReminderReceiver::class.java),
                flags,
            )
            if (pi != null) {
                am.cancel(pi)
                pi.cancel()
            }
        }
        prefs.edit().remove(KEY_CODES).apply()
    }
}
