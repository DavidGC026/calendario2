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
