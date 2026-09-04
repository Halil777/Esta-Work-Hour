package com.esta.attendance

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.esta.attendance.network.dto.BackendWorker

class ShiftWorkerAdapter(
    private val onShiftPicked: (BackendWorker, String) -> Unit
) : ListAdapter<BackendWorker, ShiftWorkerAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_shift_worker, parent, false)
        return ViewHolder(view, onShiftPicked)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(
        view: View,
        private val onShiftPicked: (BackendWorker, String) -> Unit
    ) : RecyclerView.ViewHolder(view) {
        private val tvName: TextView = view.findViewById(R.id.tvShiftWorkerName)
        private val tvTeam: TextView = view.findViewById(R.id.tvShiftWorkerTeam)
        private val btnDay: MaterialButton = view.findViewById(R.id.btnShiftDay)
        private val btnNight: MaterialButton = view.findViewById(R.id.btnShiftNight)

        fun bind(worker: BackendWorker) {
            val ctx = itemView.context
            tvName.text = worker.name
            val team = worker.brigadeName
            if (team.isNullOrBlank()) {
                tvTeam.visibility = View.GONE
            } else {
                tvTeam.visibility = View.VISIBLE
                tvTeam.text = team
            }

            styleButton(btnDay, worker.shift == "day")
            styleButton(btnNight, worker.shift == "night")

            btnDay.setOnClickListener {
                if (worker.shift != "day") onShiftPicked(worker, "day")
            }
            btnNight.setOnClickListener {
                if (worker.shift != "night") onShiftPicked(worker, "night")
            }
        }

        private fun styleButton(button: MaterialButton, selected: Boolean) {
            val ctx = itemView.context
            if (selected) {
                button.setBackgroundColor(ContextCompat.getColor(ctx, R.color.brand_primary))
                button.setTextColor(ContextCompat.getColor(ctx, R.color.white))
                button.strokeWidth = 0
            } else {
                button.setBackgroundColor(ContextCompat.getColor(ctx, R.color.bg_surface))
                button.setTextColor(ContextCompat.getColor(ctx, R.color.text_muted))
                button.strokeWidth = 2
                button.strokeColor = ContextCompat.getColorStateList(ctx, R.color.bg_border)
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<BackendWorker>() {
        override fun areItemsTheSame(oldItem: BackendWorker, newItem: BackendWorker) =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: BackendWorker, newItem: BackendWorker) =
            oldItem == newItem
    }
}
