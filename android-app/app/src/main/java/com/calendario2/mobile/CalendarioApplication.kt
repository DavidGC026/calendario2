package com.calendario2.mobile

import android.app.Application
import com.calendario2.mobile.data.TokenStore
import com.calendario2.mobile.notifications.ReminderNotifications
import com.calendario2.mobile.notifications.SyncRemindersWorker
import kotlinx.coroutines.runBlocking

class CalendarioApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ReminderNotifications.ensureChannel(this)
        runBlocking {
            TokenStore(this@CalendarioApplication).loadToken()
        }
        // Job periódico que mantiene las alarmas locales sincronizadas
        // aunque el usuario no abra la app.
        SyncRemindersWorker.enqueue(this)
    }
}
