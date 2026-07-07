package com.esta.workforce.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.esta.workforce.ui.theme.LocalAppColors
import com.esta.workforce.ui.theme.Primary

@Composable
fun StatCard(
    label: String,
    value: Any,
    modifier: Modifier = Modifier,
    accent: Color = Primary,
) {
    val colors = LocalAppColors.current
    Card(
        modifier = modifier.widthIn(min = 72.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.card),
        border = BorderStroke(1.dp, colors.border),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = value.toString(),
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                color = accent,
            )
            Text(
                text = label,
                fontSize = 11.sp,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
fun StatusPill(
    label: String,
    color: Color,
    bg: Color,
) {
    Card(
        shape = RoundedCornerShape(99.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}
