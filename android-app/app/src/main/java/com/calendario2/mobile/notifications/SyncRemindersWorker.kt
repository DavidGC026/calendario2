package com.calendario2.mobile.notifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.calendario2.mobile.BuildConfig
import com.calendario2.mobile.data.CalendarioApi
import com.calendario2.mobile.data.TokenHolder
import com.calendario2.mobile.data.TokenStore
import java.util.concurrent.TimeUnit

/**
 * Worker periódico que mantiene las notificaciones locales sincronizadas
 * aunque el usuario no abra la app durante días. Cada vez que corre
 * descarga los eventos y reprograma las alarmas.
 *
 * Frecuencia mínima permitida por WorkManager para tareas periódicas: 15 min.
 * Aquí se programa cada 6 horas para no consumir batería innecesariamente.
 */
class SyncRemindersWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            val ctx = applicationContext
            val token = TokenHolder.token ?: TokenStore(ctx).loadToken()
            if (token.isNullOrBlank()) return Result.success()
            TokenHolder.token = token
            val api = CalendarioApi.create(BuildConfig.API_BASE_URL) { TokenHolder.token }
            val events = api.events().events
            ReminderScheduler.rescheduleAll(ctx, events)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_NAME = "calendario_sync_reminders"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<SyncRemindersWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setInitialDelay(15, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_NAME)
        }
    }
}
