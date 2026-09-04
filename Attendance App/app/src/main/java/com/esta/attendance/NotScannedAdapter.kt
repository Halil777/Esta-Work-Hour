package com.esta.attendance

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.esta.attendance.network.dto.ShiftAlertWorker

class NotScannedAdapter : ListAdapter<ShiftAlertWorker, NotScannedAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_not_scanned_worker, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvName: TextView = view.findViewById(R.id.tvNotScannedName)
        private val tvTeam: TextView = view.findViewById(R.id.tvNotScannedTeam)

        fun bind(item: ShiftAlertWorker) {
            tvName.text = item.name
            val team = item.team
            if (team.isNullOrBlank()) {
                tvTeam.visibility = View.GONE
            } else {
                tvTeam.visibility = View.VISIBLE
                tvTeam.text = team
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<ShiftAlertWorker>() {
        override fun areItemsTheSame(oldItem: ShiftAlertWorker, newItem: ShiftAlertWorker) =
            oldItem.workerId == newItem.workerId

        override fun areContentsTheSame(oldItem: ShiftAlertWorker, newItem: ShiftAlertWorker) =
            oldItem == newItem
    }
}
