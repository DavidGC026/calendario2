package com.calendario2.mobile.data

import com.google.gson.annotations.SerializedName

data class LoginBody(
    val email: String,
    val password: String,
)

data class LoginResponse(
    val token: String,
    val expiresIn: Long?,
    val user: UserDto,
)

data class UserDto(
    val id: String,
    val email: String,
    val name: String?,
    val role: String?,
    val aiEnabled: Boolean? = false,
    val hasPassword: Boolean? = true,
)

data class GoogleLoginBody(
    val idToken: String,
)

data class MeResponse(
    val user: UserDto,
)

data class EventsResponse(
    val events: List<EventDto>,
)

data class EventDto(
    val id: String,
    val title: String,
    val description: String?,
    val location: String?,
    val eventDate: String,
    val startTime: String,
    val endTime: String,
    val color: String?,
    val reminderMinutesBefore: Int?,
    @SerializedName("emailRemindersEnabled")
    val emailRemindersEnabled: Boolean? = true,
)

data class CreateEventBody(
    val title: String,
    val eventDate: String,
    val startTime: String,
    val endTime: String,
    val description: String? = null,
    val location: String? = null,
    val color: String? = null,
    val reminderMinutesBefore: Int? = null,
    val emailRemindersEnabled: Boolean? = true,
    val allowConflict: Boolean? = false,
)

data class UpdateEventBody(
    val title: String? = null,
    val eventDate: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val description: String? = null,
    val location: String? = null,
    val color: String? = null,
    val reminderMinutesBefore: Int? = null,
    val emailRemindersEnabled: Boolean? = null,
    val allowConflict: Boolean? = false,
)

data class EventMutationResponse(
    val event: EventDto?,
    val conflicts: List<EventDto>? = null,
    val notFound: Boolean? = null,
)

data class SuccessResponse(val success: Boolean)

/**
 * El estado de la conexión con Google Calendar.
 *
 * La sincronización la hace el servidor, no el teléfono: aquí solo se enseña
 * cómo va y se dispara. `connectUrl` viene firmada y caduca en diez minutos, así
 * que se pide justo antes de abrirla y no se guarda en ningún sitio.
 */
data class GoogleCalendarStatus(
    val configured: Boolean = false,
    val connectUrl: String? = null,
    val link: GoogleCalendarLink? = null,
)

data class GoogleCalendarLink(
    val googleEmail: String = "",
    val calendarId: String = "primary",
    val syncEnabled: Boolean = true,
    val lastSyncAt: String? = null,
    val lastError: String? = null,
)

data class GoogleSyncResponse(
    val ok: Boolean = false,
    val result: GoogleSyncResult? = null,
    val error: String? = null,
)

data class GoogleSyncResult(
    val pushed: Int = 0,
    val pulled: Int = 0,
    val deletedHere: Int = 0,
    val deletedThere: Int = 0,
    val skipped: Int = 0,
)
