package com.workhour.worker.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workhour.worker.data.model.ChangePasswordRequest
import com.workhour.worker.data.network.ApiClient
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class PasswordState(
    val loading: Boolean = false,
    val error: String = "",
    val success: Boolean = false,
)

class SettingsViewModel : ViewModel() {

    private val _pwState = MutableStateFlow(PasswordState())
    val pwState: StateFlow<PasswordState> = _pwState.asStateFlow()

    fun changePassword(
        serverUrl: String,
        current: String,
        new_: String,
        confirm: String,
        minLength: Int = 4,
        errMismatch: String,
        errShort: String,
    ) {
        if (new_ != confirm) { _pwState.update { it.copy(error = errMismatch) }; return }
        if (new_.length < minLength) { _pwState.update { it.copy(error = errShort) }; return }

        viewModelScope.launch {
            _pwState.update { it.copy(loading = true, error = "", success = false) }
            try {
                ApiClient.get(serverUrl).changePassword(ChangePasswordRequest(current, new_))
                _pwState.update { it.copy(loading = false, success = true) }
            } catch (e: Exception) {
                val msg = e.message ?: "Failed"
                _pwState.update { it.copy(loading = false, error = msg) }
            }
        }
    }

    fun clearPasswordState() {
        _pwState.value = PasswordState()
    }
}
