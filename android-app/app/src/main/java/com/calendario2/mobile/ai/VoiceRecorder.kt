package com.calendario2.mobile.ai

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Wrapper alrededor de [MediaRecorder] para grabar una nota de voz en M4A
 * y enviarla a `POST /api/transcribe` (Whisper). Pensado para "push to talk":
 *   1. `start()` cuando el usuario pulsa el botón.
 *   2. `stopAndTranscribe()` cuando lo suelta.
 */
class VoiceRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private val httpClient by lazy {
        OkHttpClient.Builder()
            .callTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    fun start(): Boolean {
        return try {
            val file = File.createTempFile("voice_", ".m4a", context.cacheDir)
            outputFile = file
            val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            rec.setAudioSource(MediaRecorder.AudioSource.MIC)
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            rec.setAudioEncodingBitRate(96_000)
            rec.setAudioSamplingRate(44_100)
            rec.setOutputFile(file.absolutePath)
            rec.prepare()
            rec.start()
            recorder = rec
            true
        } catch (_: Exception) {
            cleanup()
            false
        }
    }

    fun cancel() {
        try { recorder?.stop() } catch (_: Exception) { }
        cleanup()
    }

    /**
     * Para la grabación, sube el audio al endpoint y devuelve la transcripción.
     * Si algo falla, devuelve null.
     */
    suspend fun stopAndTranscribe(baseUrl: String, token: String?, locale: String): String? {
        val rec = recorder
        val file = outputFile
        recorder = null
        outputFile = null
        if (rec == null || file == null) return null
        try {
            try { rec.stop() } catch (_: Exception) { }
            rec.release()
        } catch (_: Exception) { /* ignore */ }

        if (!file.exists() || file.length() < 1024) {
            file.delete()
            return null
        }

        val url = if (baseUrl.endsWith("/")) "${baseUrl}api/transcribe" else "$baseUrl/api/transcribe"
        return try {
            val mediaType = "audio/mp4".toMediaType()
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", file.name, file.asRequestBody(mediaType))
                .addFormDataPart("locale", locale)
                .build()
            val builder = Request.Builder().url(url).post(body)
            token?.let { builder.header("Authorization", "Bearer $it") }
            httpClient.newCall(builder.build()).execute().use { resp ->
                if (!resp.isSuccessful) return null
                val text = resp.body?.string().orEmpty()
                JSONObject(text).optString("text").trim().takeIf { it.isNotEmpty() }
            }
        } catch (_: Exception) {
            null
        } finally {
            try { file.delete() } catch (_: Exception) { }
        }
    }

    private fun cleanup() {
        try { recorder?.release() } catch (_: Exception) { }
        recorder = null
        try { outputFile?.delete() } catch (_: Exception) { }
        outputFile = null
    }
}
