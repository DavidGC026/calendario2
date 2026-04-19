package com.calendario2.mobile.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import kotlinx.coroutines.delay

private val HOUR_HEIGHT = 64.dp
private val LEFT_GUTTER = 44.dp

@Composable
fun DayView(
    date: LocalDate,
    today: LocalDate,
    events: List<EventDto>,
    onEventClick: (EventDto) -> Unit,
    onCreateAt: (LocalDate, Int) -> Unit,
) {
    val dayEvents = remember(date, events) { CalendarUtils.eventsOn(events, date) }
    val scroll = rememberScrollState()

    LaunchedEffect(date) {
        // Auto-scroll a 8:00 (igual que la web cuando no hay foto base).
        val targetHour = if (date == today) LocalTime.now().hour.coerceAtLeast(7) else 8
        scroll.scrollTo(((targetHour - CalendarUtils.DAY_START_HOUR) * HOUR_HEIGHT.value * 3).toInt().coerceAtLeast(0))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0x99020617))
            .border(1.dp, DvgColors.White15, RoundedCornerShape(18.dp)),
    ) {
        DayHeaderBar(date, today)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scroll),
        ) {
            HourGrid(date, onCreateAt)
            EventsLayer(dayEvents, onEventClick)
            if (date == today) NowLine()
        }
    }
}

@Composable
private fun DayHeaderBar(date: LocalDate, today: LocalDate) {
    val isToday = date == today
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(DvgColors.Slate950.copy(alpha = 0.7f))
            .border(0.dp, Color.Transparent)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = date.format(CalendarUtils.DAY_HEADER_FORMAT)
                    .replaceFirstChar { it.titlecase() },
                color = DvgColors.White95,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (isToday) {
                Text(
                    text = "Hoy",
                    color = DvgColors.Sky300,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun HourGrid(date: LocalDate, onCreateAt: (LocalDate, Int) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth()) {
        for (hour in CalendarUtils.DAY_START_HOUR..CalendarUtils.DAY_END_HOUR) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(HOUR_HEIGHT),
            ) {
                Text(
                    text = "%02d:00".format(hour),
                    color = DvgColors.White45,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier
                        .width(LEFT_GUTTER)
                        .padding(top = 2.dp, end = 6.dp),
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0x05FFFFFF))
                        .clickable { onCreateAt(date, hour) },
                )
            }
        }
    }
}

@Composable
private fun EventsLayer(events: List<EventDto>, onEventClick: (EventDto) -> Unit) {
    val totalHeight = HOUR_HEIGHT * (CalendarUtils.DAY_END_HOUR - CalendarUtils.DAY_START_HOUR + 1)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(totalHeight)
            .padding(start = LEFT_GUTTER + 4.dp, end = 6.dp),
    ) {
        events.forEach { ev ->
            val start = CalendarUtils.parseLocalTime(ev.startTime) ?: return@forEach
            val end = CalendarUtils.parseLocalTime(ev.endTime) ?: start.plusHours(1)
            val startMin = start.toSecondOfDay() / 60
            val endMin = end.toSecondOfDay() / 60
            if (endMin <= CalendarUtils.DAY_START_HOUR * 60) return@forEach
            if (startMin >= CalendarUtils.DAY_END_HOUR * 60) return@forEach

            val topMin = (startMin - CalendarUtils.DAY_START_HOUR * 60).coerceAtLeast(0)
            val bottomMin = (endMin - CalendarUtils.DAY_START_HOUR * 60).coerceAtMost(CalendarUtils.DAY_TOTAL_MIN)
            val heightMin = (bottomMin - topMin).coerceAtLeast(20)

            val accent = CalendarUtils.accentHexForColor(ev.color)
            val brush = CalendarUtils.eventBrush(ev.color)

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = HOUR_HEIGHT * (topMin / 60f))
                    .height(HOUR_HEIGHT * (heightMin / 60f))
                    .padding(top = 1.dp, bottom = 1.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
                    .background(brush)
                    .clickable { onEventClick(ev) }
                    .padding(start = 0.dp),
            ) {
                Box(modifier = Modifier.width(4.dp).fillMaxSize().background(Color.White.copy(alpha = 0.4f)))
                Column(modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) {
                    Text(
                        text = ev.title,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                    )
                    Text(
                        text = "${ev.startTime} – ${ev.endTime}",
                        color = Color.White.copy(alpha = 0.92f),
                        fontSize = 11.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun NowLine() {
    var now by remember { mutableStateOf(LocalTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            now = LocalTime.now()
        }
    }
    val nowMin = now.toSecondOfDay() / 60
    if (nowMin < CalendarUtils.DAY_START_HOUR * 60 || nowMin > CalendarUtils.DAY_END_HOUR * 60) return
    val topMin = nowMin - CalendarUtils.DAY_START_HOUR * 60
    val totalHeight = HOUR_HEIGHT * (CalendarUtils.DAY_END_HOUR - CalendarUtils.DAY_START_HOUR + 1)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(totalHeight)
            .padding(start = LEFT_GUTTER - 4.dp),
    ) {
      Box(modifier = Modifier.fillMaxWidth().offset(y = HOUR_HEIGHT * (topMin / 60f))) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(DvgColors.Rose500)
                    .border(3.dp, DvgColors.Rose500.copy(alpha = 0.25f), CircleShape),
            )
            Box(modifier = Modifier.weight(1f).height(1.dp).background(DvgColors.Rose500.copy(alpha = 0.85f)))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(DvgColors.Rose500)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text(
                    text = "%02d:%02d".format(now.hour, now.minute),
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
      }
    }
}
