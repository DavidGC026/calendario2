package com.calendario2.mobile.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore("auth")

class TokenStore(private val context: Context) {

    private val keyToken = stringPreferencesKey("jwt")

    suspend fun saveToken(token: String?) {
        context.dataStore.edit { prefs ->
            if (token == null) prefs.remove(keyToken) else prefs[keyToken] = token
        }
        TokenHolder.token = token
    }

    suspend fun loadToken(): String? {
        val t = context.dataStore.data.map { it[keyToken] }.first()
        TokenHolder.token = t
        return t
    }

    /** Para [BootReceiver] (hilo de fondo). */
    fun getTokenBlocking(): String? = runBlocking { loadToken() }
}
