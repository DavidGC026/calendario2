package com.calendario2.mobile.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.data.EventDto
import com.calendario2.mobile.ui.theme.DvgColors
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val ES = Locale("es", "ES")
private val AGENDA_HEADER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE d MMM", ES)

/**
 * Vista mensual estilo Google Calendar: cuadrícula compacta arriba y lista del
 * día seleccionado abajo (sin cambiar a vista Día).
 */
@Composable
fun MonthAgendaView(
    month: YearMonth,
    selectedDate: LocalDate,
    today: LocalDate,
    events: List<EventDto>,
    onSelectDate: (LocalDate) -> Unit,
    onEventClick: (EventDto) -> Unit,
) {
    val days = remember(month) { CalendarUtils.monthGrid(month) }
    val weekHeaders = listOf("DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB")
    val dayEvents = remember(selectedDate, events) { CalendarUtils.eventsOn(events, selectedDate) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0x99020617))
            .border(1.dp, DvgColors.White15, RoundedCornerShape(18.dp))
            .padding(10.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
            weekHeaders.forEachIndexed { i, name ->
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        text = name,
                        color = if (i == 0) Color(0xFFF87171) else DvgColors.White55,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            contentPadding = PaddingValues(0.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            modifier = Modifier
                .weight(1.15f)
                .fillMaxWidth(),
        ) {
            items(days) { date ->
                val cellEvents = remember(date, events) { CalendarUtils.eventsOn(events, date) }
                MonthCellGoogle(
                    date = date,
                    inMonth = date.month == month.month && date.year == month.year,
                    isToday = date == today,
                    isSelected = date == selectedDate,
                    events = cellEvents,
                    onClick = { onSelectDate(date) },
                )
            }
        }

        HorizontalDivider(
            modifier = Modifier.padding(vertical = 8.dp),
            color = DvgColors.White15,
            thickness = 1.dp,
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0x66020617))
                .border(1.dp, DvgColors.White10, RoundedCornerShape(14.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = selectedDate.format(AGENDA_HEADER).replaceFirstChar { c -> c.titlecase(ES) },
                    color = DvgColors.White95,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${dayEvents.size} evento${if (dayEvents.size == 1) "" else "s"}",
                    color = DvgColors.White45,
                    fontSize = 11.sp,
                )
            }
            Spacer(Modifier.height(8.dp))
            if (dayEvents.isEmpty()) {
                Text(
                    "Sin eventos este día",
                    color = DvgColors.White45,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(dayEvents, key = { it.id }) { ev ->
                        MonthAgendaEventRow(event = ev, onClick = { onEventClick(ev) })
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthAgendaEventRow(event: EventDto, onClick: () -> Unit) {
    val accent = CalendarUtils.accentHexForColor(event.color)
    val start = CalendarUtils.parseLocalTime(event.startTime)
    val end = CalendarUtils.parseLocalTime(event.endTime)
    val timeLeft = if (start != null) {
        "%02d:%02d".format(start.hour, start.minute)
    } else {
        event.startTime.take(5)
    }
    val range = if (start != null && end != null) {
        val a = "%02d:%02d".format(start.hour, start.minute)
        val b = "%02d:%02d".format(end.hour, end.minute)
        "$a – $b"
    } else {
        "${event.startTime} – ${event.endTime}"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = timeLeft,
            color = DvgColors.White55,
            fontSize = 12.sp,
            modifier = Modifier.width(44.dp),
        )
        Box(
            modifier = Modifier
                .padding(horizontal = 8.dp)
                .width(3.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(accent),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = event.title,
                color = DvgColors.White95,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = range,
                color = DvgColors.White45,
                fontSize = 11.sp,
            )
        }
    }
}

@Composable
private fun MonthCellGoogle(
    date: LocalDate,
    inMonth: Boolean,
    isToday: Boolean,
    isSelected: Boolean,
    events: List<EventDto>,
    onClick: () -> Unit,
) {
    val borderMod: Modifier = when {
        isSelected -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.75f), RoundedCornerShape(10.dp))
            .border(1.dp, DvgColors.White35, RoundedCornerShape(10.dp))
        isToday -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.7f), RoundedCornerShape(10.dp))
            .border(1.dp, DvgColors.Sky400.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
        inMonth -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
            .border(1.dp, DvgColors.White10, RoundedCornerShape(10.dp))
        else -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .border(1.dp, DvgColors.White7, RoundedCornerShape(10.dp))
    }

    Column(
        modifier = Modifier
            .aspectRatio(0.92f)
            .clip(RoundedCornerShape(10.dp))
            .then(borderMod)
            .clickable { onClick() }
            .padding(horizontal = 3.dp, vertical = 4.dp),
    ) {
        Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            if (isToday) {
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .border(1.5.dp, DvgColors.White88, CircleShape),
                )
            }
            Text(
                text = date.dayOfMonth.toString(),
                color = when {
                    isToday -> DvgColors.Sky300
                    !inMonth -> DvgColors.White35
                    else -> DvgColors.White88
                },
                fontSize = 12.sp,
                fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Medium,
            )
        }
        if (isSelected) {
            Spacer(Modifier.height(3.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.5.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(DvgColors.Sky400),
            )
        }
        Spacer(Modifier.height(4.dp))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val colors = events.take(4).map { CalendarUtils.accentHexForColor(it.color) }
            colors.forEach { c ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.dp)
                        .clip(RoundedCornerShape(1.dp))
                        .background(c),
                )
            }
        }
    }
}

@Composable
fun MonthView(
    month: YearMonth,
    selectedDate: LocalDate,
    today: LocalDate,
    events: List<EventDto>,
    onSelectDate: (LocalDate) -> Unit,
) {
    val days = remember(month) { CalendarUtils.monthGrid(month) }
    val weekHeaders = listOf("DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0x99020617))
            .border(1.dp, DvgColors.White15, RoundedCornerShape(18.dp))
            .padding(10.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
            weekHeaders.forEach { name ->
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        text = name,
                        color = DvgColors.White55,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            contentPadding = PaddingValues(0.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            items(days) { date ->
                val cellEvents = remember(date, events) { CalendarUtils.eventsOn(events, date) }
                MonthCell(
                    date = date,
                    inMonth = date.month == month.month && date.year == month.year,
                    isToday = date == today,
                    isSelected = date == selectedDate,
                    events = cellEvents,
                    onClick = { onSelectDate(date) },
                )
            }
        }
    }
}

@Composable
private fun MonthCell(
    date: LocalDate,
    inMonth: Boolean,
    isToday: Boolean,
    isSelected: Boolean,
    events: List<EventDto>,
    onClick: () -> Unit,
) {
    val border: Modifier = when {
        isSelected -> Modifier
            .background(DvgColors.Sky500.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            .border(1.dp, DvgColors.Sky400.copy(alpha = 0.8f), RoundedCornerShape(12.dp))
        isToday -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.85f), RoundedCornerShape(12.dp))
            .border(1.dp, DvgColors.Sky400.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
        inMonth -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.65f), RoundedCornerShape(12.dp))
            .border(1.dp, DvgColors.White10, RoundedCornerShape(12.dp))
        else -> Modifier
            .background(DvgColors.Slate900.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .border(1.dp, DvgColors.White7, RoundedCornerShape(12.dp))
    }

    Box(
        modifier = Modifier
            .aspectRatio(0.85f)
            .clip(RoundedCornerShape(12.dp))
            .then(border)
            .clickable { onClick() }
            .padding(horizontal = 5.dp, vertical = 4.dp),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text(
                text = date.dayOfMonth.toString(),
                color = when {
                    isToday -> DvgColors.Sky300
                    !inMonth -> DvgColors.White35
                    else -> DvgColors.White88
                },
                fontSize = 12.sp,
                fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.SemiBold,
            )
            Spacer(Modifier.size(2.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                events.take(2).forEach { ev ->
                    val accent = CalendarUtils.accentHexForColor(ev.color)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(4.dp))
                            .background(accent.copy(alpha = 0.15f))
                            .border(0.dp, Color.Transparent)
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(width = 2.5.dp, height = 8.dp)
                                    .background(accent),
                            )
                            Spacer(Modifier.size(3.dp))
                            Text(
                                text = ev.title,
                                color = DvgColors.White95,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                            )
                        }
                    }
                }
                if (events.size > 2) {
                    Text(
                        text = "+${events.size - 2}",
                        color = DvgColors.White55,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}
