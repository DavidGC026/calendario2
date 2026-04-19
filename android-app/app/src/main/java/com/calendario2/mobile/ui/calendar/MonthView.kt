package com.calendario2.mobile.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import java.time.YearMonth

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
