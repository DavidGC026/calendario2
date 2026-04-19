package com.calendario2.mobile.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.calendario2.mobile.data.EventDto
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Programa notificaciones locales alineadas con la app web:
 * - ~8:00 del día del evento (zona horaria del dispositivo)
 * - X minutos antes del inicio si el evento tiene [EventDto.reminderMinutesBefore]
 *
 * Usa AlarmManager con `setAlarmClock` cuando hay permiso de alarmas exactas
 * (Android 12+) y cae a `setAndAllowWhileIdle` si el sistema rechaza el
 * exact-alarm; ambos ignoran Doze.
 */
object ReminderScheduler {

    private const val TAG = "ReminderScheduler"
    private const val PREFS = "calendario_alarm_codes"
    private const val KEY_CODES = "codes"

    /**
     * En Android 12+ (API 31+) las alarmas exactas requieren permiso
     * explícito (SCHEDULE_EXACT_ALARM). En API 33+ existe USE_EXACT_ALARM
     * que se concede automáticamente para apps de calendario/alarma.
     * Esta función indica si podemos usar `setAlarmClock` sin SecurityException.
     */
    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    fun rescheduleAll(context: Context, events: List<EventDto>) {
        cancelAll(context)
        val zone = ZoneId.systemDefault()
        val now = ZonedDateTime.now(zone)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val newCodes = mutableSetOf<String>()
        var scheduled = 0

        for (e in events) {
            if (e.emailRemindersEnabled == false) continue
            val start = eventStart(e, zone) ?: continue
            if (!start.isAfter(now)) continue

            // Recordatorio del día (~8:00)
            val morning = LocalDate.parse(e.eventDate).atTime(8, 0).atZone(zone)
            if (morning.isAfter(now)) {
                if (schedule(
                        context, am, e, "morning", morning,
                        "Hoy: ${e.title}",
                        morningSubtitle(e),
                        newCodes,
                    )
                ) scheduled++
            }

            val mins = e.reminderMinutesBefore
            if (mins != null && mins > 0) {
                val fire = start.minusMinutes(mins.toLong())
                if (fire.isAfter(now)) {
                    if (schedule(
                            context, am, e, "advance", fire,
                            e.title,
                            advanceSubtitle(e, mins),
                            newCodes,
                        )
                    ) scheduled++
                }
            }
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_CODES, newCodes)
            .apply()

        Log.i(TAG, "Reprogramadas $scheduled alarmas para ${events.size} eventos")
    }

    private fun morningSubtitle(e: EventDto): String {
        val place = e.location?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
        return "${e.startTime} – ${e.endTime}$place"
    }

    private fun advanceSubtitle(e: EventDto, mins: Int): String {
        val readable = when {
            mins >= 1440 -> if (mins / 1440 == 1) "1 día" else "${mins / 1440} días"
            mins >= 60 -> if (mins / 60 == 1) "1 hora" else "${mins / 60} horas"
            else -> "$mins min"
        }
        val place = e.location?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
        return "Empieza en $readable · ${e.startTime}$place"
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
    ): Boolean {
        val rc = requestCode(e.id, kind)
        codes.add("$rc")
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_FIRE
            data = android.net.Uri.parse("calendario://reminder/${e.id}/$kind")
            putExtra(ReminderReceiver.EXTRA_TITLE, title)
            putExtra(ReminderReceiver.EXTRA_TEXT, text)
            putExtra(ReminderReceiver.EXTRA_NOTIFY_ID, rc)
            putExtra(ReminderReceiver.EXTRA_EVENT_ID, e.id)
            putExtra(ReminderReceiver.EXTRA_EVENT_DATE, e.eventDate)
            putExtra(ReminderReceiver.EXTRA_EVENT_COLOR, e.color)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pi = PendingIntent.getBroadcast(context, rc, intent, flags)
        val trigger = whenZ.toInstant().toEpochMilli()

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(trigger, pi), pi)
            } else {
                @Suppress("DEPRECATION")
                am.setExact(AlarmManager.RTC_WAKEUP, trigger, pi)
            }
            true
        } catch (se: SecurityException) {
            Log.w(TAG, "Sin permiso para alarmas exactas; uso fallback", se)
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
                true
            } catch (e: Exception) {
                Log.e(TAG, "No se pudo programar alarma", e)
                false
            }
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

    const val ACTION_FIRE = "com.calendario2.mobile.action.FIRE_REMINDER"
}
