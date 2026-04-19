package com.calendario2.mobile.data

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface CalendarioApi {

    @POST("api/mobile/login")
    suspend fun login(@Body body: LoginBody): LoginResponse

    @GET("api/mobile/me")
    suspend fun me(): MeResponse

    @GET("api/events")
    suspend fun events(): EventsResponse

    companion object {
        fun create(baseUrl: String, tokenProvider: () -> String?): CalendarioApi {
            val log = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            val client = OkHttpClient.Builder()
                .addInterceptor(log)
                .addInterceptor { chain ->
                    val t = tokenProvider()
                    val req = if (t != null) {
                        chain.request().newBuilder()
                            .header("Authorization", "Bearer $t")
                            .build()
                    } else {
                        chain.request()
                    }
                    chain.proceed(req)
                }
                .build()
            val base = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
            return Retrofit.Builder()
                .baseUrl(base)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(CalendarioApi::class.java)
        }
    }
}
