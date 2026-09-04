package com.esta.attendance

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.esta.attendance.data.local.model.AttendanceEventWithWorker
import java.text.SimpleDateFormat
import java.util.*

class AttendanceEventAdapter :
    ListAdapter<AttendanceEventWithWorker, AttendanceEventAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_attendance_event, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val statusIndicator: View = view.findViewById(R.id.statusIndicator)
        private val tvWorkerName: TextView = view.findViewById(R.id.tvWorkerName)
        private val tvEventDetails: TextView = view.findViewById(R.id.tvEventDetails)
        private val tvSyncStatus: TextView = view.findViewById(R.id.tvSyncStatus)
        private val tvTime: TextView = view.findViewById(R.id.tvTime)
        private val tvDate: TextView = view.findViewById(R.id.tvDate)

        private val timeFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
        private val dateFmt = SimpleDateFormat("dd MMM", Locale.getDefault())

        fun bind(item: AttendanceEventWithWorker) {
            val event = item.event
            val worker = item.worker
            val ctx = itemView.context

            tvWorkerName.text = worker?.fullName ?: ctx.getString(R.string.nfc_unavailable)
            tvTime.text = timeFmt.format(Date(event.eventTime))
            tvDate.text = dateFmt.format(Date(event.eventTime))

            val isCheckIn = event.eventType == "CHECK_IN"

            val eventColor = if (isCheckIn)
                ContextCompat.getColor(ctx, R.color.checkin_color)
            else
                ContextCompat.getColor(ctx, R.color.checkout_color)

            tvEventDetails.text = if (isCheckIn)
                ctx.getString(R.string.check_in)
            else
                ctx.getString(R.string.check_out)

            tvEventDetails.setTextColor(eventColor)
            statusIndicator.setBackgroundColor(eventColor)

            // Sync status chip
            tvSyncStatus.text = when (event.syncStatus) {
                "SYNCED" -> ctx.getString(R.string.sync_synced)
                "FAILED" -> ctx.getString(R.string.sync_failed)
                else -> ctx.getString(R.string.sync_pending)
            }

            val syncColor = when (event.syncStatus) {
                "SYNCED" -> ContextCompat.getColor(ctx, R.color.sync_synced)
                "FAILED" -> ContextCompat.getColor(ctx, R.color.error_color)
                else -> ContextCompat.getColor(ctx, R.color.sync_pending)
            }
            tvSyncStatus.setTextColor(syncColor)
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<AttendanceEventWithWorker>() {
        override fun areItemsTheSame(
            oldItem: AttendanceEventWithWorker,
            newItem: AttendanceEventWithWorker
        ) = oldItem.event.id == newItem.event.id

        override fun areContentsTheSame(
            oldItem: AttendanceEventWithWorker,
            newItem: AttendanceEventWithWorker
        ) = oldItem == newItem
    }
}
