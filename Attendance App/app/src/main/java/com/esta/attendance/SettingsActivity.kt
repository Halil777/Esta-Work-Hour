package com.esta.attendance

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import com.google.android.material.appbar.MaterialToolbar

class SettingsActivity : BaseActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbarSettings)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        findViewById<View>(R.id.itemTheme).setOnClickListener { showThemeDialog() }
        findViewById<View>(R.id.itemLanguage).setOnClickListener { showLanguageDialog() }
        findViewById<View>(R.id.itemFixCard).setOnClickListener {
            startActivity(Intent(this, FixCardActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        updateCurrentValues()
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun updateCurrentValues() {
        val prefs = getSharedPreferences("esta_prefs", Context.MODE_PRIVATE)

        val themeMode = prefs.getString("theme_mode", "dark") ?: "dark"
        findViewById<TextView>(R.id.tvThemeValue).text = when (themeMode) {
            "light"  -> getString(R.string.theme_light)
            "system" -> getString(R.string.theme_system)
            else     -> getString(R.string.theme_dark)
        }

        val lang = prefs.getString("language", "en") ?: "en"
        findViewById<TextView>(R.id.tvLanguageValue).text = when (lang) {
            "ru" -> "Русский"
            "tr" -> "Türkçe"
            else -> "English"
        }

        findViewById<TextView>(R.id.tvFixCardValue).text = getString(R.string.settings_fix_card_subtitle)
    }
}
