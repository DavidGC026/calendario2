package com.calendario2.mobile.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.ui.theme.DvgColors
import java.time.LocalDate
import java.time.LocalTime

private val HOUR_HEIGHT = 48.dp
private val GUTTER = 36.dp

@Composable
fun WeekView(
    selectedDate: LocalDate,
    today: LocalDate,
    events: List<EventDto>,
    onEventClick: (EventDto) -> Unit,
    onSelectDay: (LocalDate) -> Unit,
) {
    val days = remember(selectedDate) { CalendarUtils.weekOf(selectedDate) }
    val scroll = rememberScrollState()

    LaunchedEffect(days.first(), today) {
        val targetHour = if (today in days) LocalTime.now().hour.coerceAtLeast(7) else 8
        scroll.scrollTo(((targetHour - CalendarUtils.DAY_START_HOUR) * HOUR_HEIGHT.value * 3).toInt().coerceAtLeast(0))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0x99020617))
            .border(1.dp, DvgColors.White15, RoundedCornerShape(18.dp)),
    ) {
        Row(modifier = Modifier.fillMaxWidth().background(DvgColors.Slate950.copy(alpha = 0.7f))) {
            Spacer(Modifier.width(GUTTER))
            days.forEach { d ->
                val isToday = d == today
                val isSel = d == selectedDate
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelectDay(d) }
                        .background(
                            when {
                                isToday -> DvgColors.Sky500.copy(alpha = 0.10f)
                                isSel -> DvgColors.White5
                                else -> Color.Transparent
                            },
                        )
                        .padding(vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = CalendarUtils.shortDayName(d.dayOfWeek),
                        color = DvgColors.White55,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = d.dayOfMonth.toString(),
                        color = if (isToday) DvgColors.Sky300 else DvgColors.White88,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }

        Box(modifier = Modifier.fillMaxSize().verticalScroll(scroll)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.width(GUTTER)) {
                    for (h in CalendarUtils.DAY_START_HOUR..CalendarUtils.DAY_END_HOUR) {
                        Box(modifier = Modifier.height(HOUR_HEIGHT)) {
                            Text(
                                text = "%02d".format(h),
                                color = DvgColors.White45,
                                fontSize = 9.sp,
                                modifier = Modifier.padding(top = 2.dp, start = 4.dp),
                            )
                        }
                    }
                }
                days.forEach { d ->
                    DayColumn(
                        date = d,
                        isToday = d == today,
                        events = events,
                        onEventClick = onEventClick,
                        onSelectDay = onSelectDay,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayColumn(
    date: LocalDate,
    isToday: Boolean,
    events: List<EventDto>,
    onEventClick: (EventDto) -> Unit,
    onSelectDay: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val dayEvents = remember(date, events) { CalendarUtils.eventsOn(events, date) }
    val totalHeight = HOUR_HEIGHT * (CalendarUtils.DAY_END_HOUR - CalendarUtils.DAY_START_HOUR + 1)

    Box(
        modifier = modifier
            .height(totalHeight)
            .background(if (isToday) DvgColors.Sky500.copy(alpha = 0.06f) else Color.Transparent)
            .border(
                width = 0.5.dp,
                color = DvgColors.White10,
                shape = RoundedCornerShape(0.dp),
            )
            .clickable { onSelectDay(date) }
            .padding(horizontal = 1.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            for (h in CalendarUtils.DAY_START_HOUR..CalendarUtils.DAY_END_HOUR) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(HOUR_HEIGHT)
                        .background(Color(0x06FFFFFF)),
                )
            }
        }

        dayEvents.forEach { ev ->
            val start = CalendarUtils.parseLocalTime(ev.startTime) ?: return@forEach
            val end = CalendarUtils.parseLocalTime(ev.endTime) ?: start.plusHours(1)
            val startMin = start.toSecondOfDay() / 60
            val endMin = end.toSecondOfDay() / 60
            if (endMin <= CalendarUtils.DAY_START_HOUR * 60) return@forEach
            if (startMin >= CalendarUtils.DAY_END_HOUR * 60) return@forEach
            val topMin = (startMin - CalendarUtils.DAY_START_HOUR * 60).coerceAtLeast(0)
            val bottomMin = (endMin - CalendarUtils.DAY_START_HOUR * 60).coerceAtMost(CalendarUtils.DAY_TOTAL_MIN)
            val heightMin = (bottomMin - topMin).coerceAtLeast(20)

            val brush = CalendarUtils.eventBrush(ev.color)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = HOUR_HEIGHT * (topMin / 60f))
                    .height(HOUR_HEIGHT * (heightMin / 60f))
                    .padding(start = 1.dp, end = 1.dp, top = 1.dp, bottom = 1.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(6.dp))
                    .background(brush)
                    .clickable { onEventClick(ev) }
                    .padding(horizontal = 3.dp, vertical = 2.dp),
            ) {
                Text(
                    text = ev.title,
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                )
            }
        }
    }
}
