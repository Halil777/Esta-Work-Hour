package com.esta.attendance

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.esta.attendance.network.RetrofitClient
import com.esta.attendance.network.dto.DeviceSetupRequest
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class SetupActivity : BaseActivity() {

    private lateinit var etServerUrl: TextInputEditText
    private lateinit var etUsername: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnConnect: Button
    private lateinit var tvError: TextView
    private lateinit var btnLang: TextView
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        prefs = getSharedPreferences("esta_prefs", MODE_PRIVATE)

        etServerUrl = findViewById(R.id.etServerUrl)
        etUsername   = findViewById(R.id.etUsername)
        etPassword   = findViewById(R.id.etPassword)
        btnConnect   = findViewById(R.id.btnConnect)
        tvError      = findViewById(R.id.tvSetupError)
        btnLang      = findViewById(R.id.btnLangSetup)

        updateLangLabel()

        // Pre-fill if already saved
        etServerUrl.setText(prefs.getString("server_url", "") ?: "")
        etUsername.setText(prefs.getString("setup_username", "") ?: "")

        btnConnect.setOnClickListener { attemptSetup() }
        btnLang.setOnClickListener { showLanguageDialog() }
    }

    private fun updateLangLabel() {
        val lang = prefs.getString("language", "en") ?: "en"
        val label = when (lang) {
            "ru" -> "🌐 RU"
            "tr" -> "🌐 TR"
            else -> "🌐 EN"
        }
        btnLang.text = label
    }

    private fun attemptSetup() {
        val url      = etServerUrl.text?.toString()?.trim() ?: ""
        val username = etUsername.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""

        if (url.isEmpty()) { showError(getString(R.string.error_url_required)); return }
        if (username.isEmpty()) { showError(getString(R.string.error_username_required)); return }
        if (password.isEmpty()) { showError(getString(R.string.error_password_required)); return }

        val normalUrl = url.trimEnd('/')

        prefs.edit().putString("server_url", normalUrl).remove("device_token").apply()

        setLoading(true)
        tvError.visibility = View.GONE

        val tempApi = RetrofitClient.create(this)

        lifecycleScope.launch {
            try {
                val resp = tempApi.deviceSetup(DeviceSetupRequest(username, password))

                prefs.edit()
                    .putString("server_url", normalUrl)
                    .putString("device_token", resp.deviceToken)
                    .putString("tenant_name", resp.tenantName)
                    .putString("tenant_logo_url", resp.tenantLogoUrl ?: "")
                    .putString("device_label", resp.deviceLabel)
                    .putString("device_location", resp.deviceLocation ?: "")
                    .putString("operator_name", resp.operatorName)
                    .putString("setup_username", username)
                    .putBoolean("setup_done", true)
                    .apply()

                startActivity(Intent(this@SetupActivity, MainActivity::class.java))
                finish()
            } catch (e: Exception) {
                val msg = e.message ?: ""
                showError(
                    when {
                        msg.contains("401") || msg.contains("Unauthorized", true) ->
                            getString(R.string.error_invalid_credentials)
                        msg.contains("404") || msg.contains("Not Found", true) ->
                            getString(R.string.error_device_not_configured)
                        msg.contains("Unable to resolve") || msg.contains("timeout", true) ->
                            getString(R.string.error_server_not_found, normalUrl)
                        else -> msg
                    }
                )
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        btnConnect.isEnabled = !loading
        btnConnect.text = if (loading) getString(R.string.setup_connecting) else getString(R.string.setup_connect)
    }

    private fun showError(msg: String) {
        tvError.text = msg
        tvError.visibility = if (msg.isEmpty()) View.GONE else View.VISIBLE
    }
}
