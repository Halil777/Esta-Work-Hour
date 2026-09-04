package com.esta.attendance

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Short audio + haptic cues for NFC scan outcomes. A kiosk device usually
 * sits at arm's length in a noisy, dusty site — an operator scanning a
 * whole crew through in the morning shouldn't have to stare at the screen
 * after every single tap to know whether it worked. ToneGenerator needs no
 * bundled audio assets, and both APIs are fire-and-forget, so this never
 * blocks or risks breaking the actual scan flow.
 */
object ScanFeedback {

    private fun vibrator(context: Context): Vibrator? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun vibrate(context: Context, pattern: LongArray) {
        try {
            val v = vibrator(context) ?: return
            if (!v.hasVibrator()) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // Feedback is a nice-to-have — never let it interrupt a scan.
        }
    }

    private fun tone(toneType: Int, durationMs: Int) {
        try {
            val gen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90)
            gen.startTone(toneType, durationMs)
            Handler(Looper.getMainLooper()).postDelayed(
                { try { gen.release() } catch (e: Exception) { /* already released */ } },
                (durationMs + 50).toLong()
            )
        } catch (e: Exception) {
            // Same — never let feedback break the scan flow.
        }
    }

    /** Card recognized, attendance event recorded. */
    fun success(context: Context) {
        tone(ToneGenerator.TONE_PROP_BEEP, 120)
        vibrate(context, longArrayOf(0, 60))
    }

    /** Card not recognized locally — the "bind to worker" screen is shown. */
    fun unknown(context: Context) {
        tone(ToneGenerator.TONE_PROP_NACK, 250)
        vibrate(context, longArrayOf(0, 80, 80, 80))
    }

    /** Recognized, but something needs the operator's attention — e.g. a
     * cross-device duplicate warning (already checked in elsewhere). */
    fun warning(context: Context) {
        tone(ToneGenerator.TONE_SUP_ERROR, 350)
        vibrate(context, longArrayOf(0, 150, 100, 150))
    }
}
