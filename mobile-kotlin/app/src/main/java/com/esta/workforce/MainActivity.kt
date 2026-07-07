package com.esta.workforce

import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider
import com.esta.workforce.ui.AppViewModel
import com.esta.workforce.ui.navigation.AppNavigation
import com.esta.workforce.ui.theme.WorkforceTheme

class MainActivity : ComponentActivity() {

    private lateinit var appVm: AppViewModel
    private var nfcAdapter: NfcAdapter? = null
    private var pendingNfcIntent: PendingIntent? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as WorkforceApp).container

        // Create AppViewModel via ViewModelProvider so it's accessible in onNewIntent
        appVm = ViewModelProvider(
            this,
            AppViewModel.factory(container.prefs, container.api)
        )[AppViewModel::class.java]

        // NFC setup
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter != null) {
            pendingNfcIntent = PendingIntent.getActivity(
                this, 0,
                Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_MUTABLE,
            )
        }

        setContent {
            WorkforceTheme(appVm = appVm) {
                AppNavigation(appVm = appVm, container = container)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.enableForegroundDispatch(this, pendingNfcIntent, null, null)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
        tag?.let {
            val uid = it.id.joinToString(":") { byte -> "%02X".format(byte) }
            appVm.emitNfcUid(uid)
        }
    }
}
