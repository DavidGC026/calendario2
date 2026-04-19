package com.calendario2.mobile

import android.app.Application
import com.calendario2.mobile.data.TokenStore
import com.calendario2.mobile.notifications.ReminderNotifications
import kotlinx.coroutines.runBlocking

class CalendarioApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ReminderNotifications.ensureChannel(this)
        runBlocking {
            TokenStore(this@CalendarioApplication).loadToken()
        }
    }
}
