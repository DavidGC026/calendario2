package com.calendario2.mobile.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Preferencias de UI: fondo personalizado, etc. Se guardan en
 * `prefs.preferences_pb` aparte del `auth.preferences_pb` para no mezclar
 * con datos sensibles.
 */
private val Context.uiDataStore by preferencesDataStore(name = "prefs")

class PreferencesStore(private val context: Context) {

    private val backgroundKey = stringPreferencesKey("background_uri")

    val backgroundUriFlow: Flow<String?> =
        context.uiDataStore.data.map { it[backgroundKey] }

    suspend fun setBackgroundUri(uri: String?) {
        context.uiDataStore.edit { p ->
            if (uri.isNullOrBlank()) p.remove(backgroundKey) else p[backgroundKey] = uri
        }
    }

    companion object {
        /** Foto por defecto (la misma que usa la web). */
        const val DEFAULT_BACKGROUND_URL =
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop"
    }
}
