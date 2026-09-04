package com.esta.attendance

import android.content.Context
import android.content.res.Configuration
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import java.util.*

open class BaseActivity : AppCompatActivity() {

    override fun attachBaseContext(newBase: Context) {
        val prefs = newBase.getSharedPreferences("esta_prefs", Context.MODE_PRIVATE)
        val lang = prefs.getString("language", "en") ?: "en"
        val locale = Locale(lang)
        Locale.setDefault(locale)
        val config = Configuration(newBase.resources.configuration)
        config.setLocale(locale)
        super.attachBaseContext(newBase.createConfigurationContext(config))
    }

    fun showLanguageDialog() {
        val labels = arrayOf("English", "Русский", "Türkçe")
        val codes  = arrayOf("en",      "ru",      "tr")
        val prefs  = getSharedPreferences("esta_prefs", Context.MODE_PRIVATE)
        val current = prefs.getString("language", "en") ?: "en"
        val currentIdx = codes.indexOf(current).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("Language / Язык / Dil")
            .setSingleChoiceItems(labels, currentIdx) { dialog, idx ->
                prefs.edit().putString("language", codes[idx]).apply()
                dialog.dismiss()
                recreate()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    fun showThemeDialog() {
        val modes  = arrayOf("dark",                   "light",                   "system")
        val labels = arrayOf(
            getString(R.string.theme_dark),
            getString(R.string.theme_light),
            getString(R.string.theme_system)
        )
        val prefs   = getSharedPreferences("esta_prefs", Context.MODE_PRIVATE)
        val current = prefs.getString("theme_mode", "dark") ?: "dark"
        val currentIdx = modes.indexOf(current).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.settings))
            .setSingleChoiceItems(labels, currentIdx) { dialog, idx ->
                val selected = modes[idx]
                prefs.edit().putString("theme_mode", selected).apply()
                val nightMode = when (selected) {
                    "light"  -> AppCompatDelegate.MODE_NIGHT_NO
                    "system" -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                    else     -> AppCompatDelegate.MODE_NIGHT_YES
                }
                AppCompatDelegate.setDefaultNightMode(nightMode)
                dialog.dismiss()
                recreate()
            }
            .setNegativeButton(getString(R.string.biometric_cancel), null)
            .show()
    }
}
