package com.calendario2.mobile.ui.calendar

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.calendario2.mobile.data.EventDto
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

object CalendarUtils {
    private val LOCALE_ES = Locale("es")

    val MONTH_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("LLLL yyyy", LOCALE_ES)
    val DAY_HEADER_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE d 'de' LLLL", LOCALE_ES)

    const val DAY_START_HOUR = 7
    const val DAY_END_HOUR = 22
    const val DAY_TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60

    /** Cuadrícula del mes (6 semanas × 7 días, empezando en domingo). */
    fun monthGrid(month: YearMonth): List<LocalDate> {
        val first = month.atDay(1)
        val offsetFromSunday = (first.dayOfWeek.value % 7)
        val start = first.minusDays(offsetFromSunday.toLong())
        return (0 until 42).map { start.plusDays(it.toLong()) }
    }

    /** Domingo a sábado de la semana de `date`. */
    fun weekOf(date: LocalDate): List<LocalDate> {
        val offset = date.dayOfWeek.value % 7
        val start = date.minusDays(offset.toLong())
        return (0 until 7).map { start.plusDays(it.toLong()) }
    }

    fun parseLocalDate(iso: String): LocalDate? = try { LocalDate.parse(iso) } catch (_: Exception) { null }
    fun parseLocalTime(t: String): LocalTime? = try { LocalTime.parse(t) } catch (_: Exception) { null }

    fun eventsOn(events: List<EventDto>, date: LocalDate): List<EventDto> {
        val iso = date.toString()
        return events.filter { it.eventDate == iso }.sortedBy { it.startTime }
    }

    fun shortDayName(d: DayOfWeek): String =
        d.getDisplayName(TextStyle.SHORT, LOCALE_ES).uppercase().take(3)

    /** Hex sólido. Idéntico a `lib/calendar-view-utils.ts > accentHexForColor`. */
    fun accentHexForColor(color: String?): Color = when (color) {
        "bg-green-500" -> Color(0xFF22c55e)
        "bg-orange-500" -> Color(0xFFf97316)
        "bg-purple-500" -> Color(0xFFa855f7)
        "bg-pink-500" -> Color(0xFFec4899)
        "bg-yellow-500" -> Color(0xFFeab308)
        "bg-cyan-500" -> Color(0xFF06b6d4)
        "bg-red-500" -> Color(0xFFef4444)
        "bg-violet-500" -> Color(0xFF8b5cf6)
        "bg-blue-500" -> Color(0xFF3b82f6)
        else -> Color(0xFF3b82f6)
    }

    /** Reproduce `eventBlockStyle` de la web (gradiente diagonal 145°). */
    fun eventBrush(color: String?): Brush {
        val (a, b) = when (color) {
            "bg-blue-500" -> Color(0xFF3b82f6) to Color(0xFF2563eb)
            "bg-green-500" -> Color(0xFF22c55e) to Color(0xFF16a34a)
            "bg-orange-500" -> Color(0xFFf97316) to Color(0xFFea580c)
            "bg-purple-500" -> Color(0xFFa855f7) to Color(0xFF9333ea)
            "bg-pink-500" -> Color(0xFFec4899) to Color(0xFFdb2777)
            "bg-yellow-500" -> Color(0xFFeab308) to Color(0xFFca8a04)
            "bg-cyan-500" -> Color(0xFF06b6d4) to Color(0xFF0891b2)
            "bg-red-500" -> Color(0xFFef4444) to Color(0xFFdc2626)
            "bg-violet-500" -> Color(0xFF8b5cf6) to Color(0xFF7c3aed)
            else -> Color(0xFF6366f1) to Color(0xFF4f46e5)
        }
        return Brush.linearGradient(listOf(a, b))
    }

    /**
     * Lanes oficiales — coincide con `CALENDAR_LANE_COLORS` y `LANE_LABELS`
     * de `lib/calendar-lanes.ts`.
     */
    val LANES: List<Lane> = listOf(
        Lane("bg-blue-500", "Mi calendario", Color(0xFF3b82f6)),
        Lane("bg-green-500", "Trabajo", Color(0xFF22c55e)),
        Lane("bg-orange-500", "Personal", Color(0xFFf97316)),
        Lane("bg-purple-500", "Familia", Color(0xFFa855f7)),
    )

    fun laneLabel(color: String?): String =
        LANES.firstOrNull { it.colorClass == color }?.label ?: "Mi calendario"
}

data class Lane(val colorClass: String, val label: String, val accent: Color)
