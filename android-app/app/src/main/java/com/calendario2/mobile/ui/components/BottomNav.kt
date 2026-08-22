package com.calendario2.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CalendarViewWeek
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.calendario2.mobile.ui.theme.DvgColors

enum class CalendarMode { Day, Week, Month }

@Composable
fun BottomNavBar(
    mode: CalendarMode,
    onSelectMode: (CalendarMode) -> Unit,
    onGoToday: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(DvgColors.Slate950.copy(alpha = 0.88f))
            .border(width = 0.5.dp, color = DvgColors.Gold400.copy(alpha = 0.18f))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NavItem("Día", Icons.Default.CalendarToday, mode == CalendarMode.Day, Modifier.weight(1f)) { onSelectMode(CalendarMode.Day) }
        NavItem("Semana", Icons.Default.CalendarViewWeek, mode == CalendarMode.Week, Modifier.weight(1f)) { onSelectMode(CalendarMode.Week) }
        NavItem("Mes", Icons.Default.CalendarMonth, mode == CalendarMode.Month, Modifier.weight(1f)) { onSelectMode(CalendarMode.Month) }
        NavItem("Hoy", Icons.Default.MyLocation, false, Modifier.weight(1f), onClick = onGoToday)
    }
}

@Composable
private fun NavItem(
    label: String,
    icon: ImageVector,
    active: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val tint = if (active) DvgColors.Gold400 else DvgColors.White55
    val bg = if (active) DvgColors.BrandRed.copy(alpha = 0.25f) else Color.Transparent
    Column(
        modifier = modifier
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .clickable(role = Role.Tab, onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(20.dp))
        Spacer(Modifier.size(2.dp))
        Text(
            text = label,
            color = tint,
            fontSize = 10.sp,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
        )
    }
}
