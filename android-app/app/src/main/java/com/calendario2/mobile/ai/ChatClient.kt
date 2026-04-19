package com.calendario2.mobile.ai

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

/**
 * Cliente HTTP para el endpoint `POST /api/chat` (Vercel AI SDK v5
 * UI Message Stream Protocol). Devuelve un flujo de [ChatStreamEvent]
 * con los deltas de texto y los resultados de las herramientas que se
 * ejecutan en el servidor (createEvent, updateEvent, deleteEvent…).
 *
 * Formato del stream SSE esperado:
 *   data: {"type":"text-delta","delta":"…"}
 *   data: {"type":"tool-output-available","toolName":"createEvent","output":{…}}
 *   data: [DONE]
 */
sealed class ChatStreamEvent {
    data class TextDelta(val delta: String) : ChatStreamEvent()
    data class ToolResult(val toolName: String, val output: JsonObject) : ChatStreamEvent()
    data class Error(val message: String) : ChatStreamEvent()
    data object Finish : ChatStreamEvent()
}

data class UiChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String, // "user" | "assistant"
    val text: String,
    /**
     * Lista de URLs de adjuntos en formato `data:image/jpeg;base64,…`. Solo
     * se usa para mensajes de usuario; en el SDK los enviamos como
     * `parts: [{type:"file", mediaType:"image/jpeg", url:"data:…"}]`.
     */
    val imageDataUrls: List<String> = emptyList(),
)

class ChatClient(
    private val baseUrl: String,
    private val tokenProvider: () -> String?,
) {
    private val client = OkHttpClient.Builder()
        // El backend tiene maxDuration=60s; damos margen para múltiples herramientas.
        .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
        .callTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    fun stream(messages: List<UiChatMessage>): Flow<ChatStreamEvent> = flow {
        val url = if (baseUrl.endsWith("/")) "${baseUrl}api/chat" else "$baseUrl/api/chat"
        val today = java.time.LocalDate.now().toString()
        val payload = mapOf(
            "id" to UUID.randomUUID().toString(),
            "messages" to messages.map { m ->
                val parts = mutableListOf<Map<String, Any>>()
                if (m.text.isNotBlank()) {
                    parts += mapOf("type" to "text", "text" to m.text)
                }
                for (url in m.imageDataUrls) {
                    val mt = if (url.startsWith("data:")) {
                        url.substringAfter("data:").substringBefore(";")
                            .ifBlank { "image/jpeg" }
                    } else "image/jpeg"
                    parts += mapOf(
                        "type" to "file",
                        "mediaType" to mt,
                        "url" to url,
                    )
                }
                if (parts.isEmpty()) {
                    parts += mapOf("type" to "text", "text" to "")
                }
                mapOf(
                    "id" to m.id,
                    "role" to m.role,
                    "parts" to parts,
                )
            },
            "locale" to "es",
            "today" to today,
        )
        val body = gson.toJson(payload).toRequestBody("application/json".toMediaType())

        val builder = Request.Builder()
            .url(url)
            .post(body)
            .header("Accept", "text/event-stream")
        tokenProvider()?.let { builder.header("Authorization", "Bearer $it") }

        val response = client.newCall(builder.build()).execute()
        if (!response.isSuccessful) {
            val errBody = response.body?.string().orEmpty()
            emit(ChatStreamEvent.Error("HTTP ${response.code}: ${errBody.take(200)}"))
            response.close()
            return@flow
        }

        val source = response.body?.source()
        if (source == null) {
            emit(ChatStreamEvent.Error("Respuesta sin cuerpo"))
            response.close()
            return@flow
        }

        try {
            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break
                if (line.isBlank()) continue
                if (!line.startsWith("data:")) continue
                val payloadStr = line.substring(5).trim()
                if (payloadStr == "[DONE]") {
                    emit(ChatStreamEvent.Finish)
                    break
                }
                val event = parseEvent(payloadStr) ?: continue
                emit(event)
            }
        } finally {
            response.close()
        }
    }.flowOn(Dispatchers.IO)

    private fun parseEvent(json: String): ChatStreamEvent? {
        return try {
            val obj = JsonParser.parseString(json).asJsonObject
            when (obj.get("type")?.asString) {
                "text-delta" -> {
                    val delta = obj.get("delta")?.asString ?: return null
                    ChatStreamEvent.TextDelta(delta)
                }
                "tool-output-available" -> {
                    val toolName = obj.get("toolName")?.asString
                        ?: obj.get("tool")?.asString
                        ?: return null
                    val output = obj.get("output")?.asJsonObject ?: JsonObject()
                    ChatStreamEvent.ToolResult(toolName, output)
                }
                "error" -> {
                    val msg = obj.get("errorText")?.asString
                        ?: obj.get("message")?.asString
                        ?: "Error desconocido"
                    ChatStreamEvent.Error(msg)
                }
                "finish" -> ChatStreamEvent.Finish
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }
}
