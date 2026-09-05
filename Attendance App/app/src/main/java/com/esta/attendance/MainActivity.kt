package com.esta.attendance

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.os.Looper
import androidx.activity.result.contract.ActivityResultContracts
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.TextView
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.esta.attendance.data.local.entity.Worker
import com.esta.attendance.network.dto.CardAssignRequest
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*
import kotlin.coroutines.resume

// Wraps a Worker for the binding dropdown so ArrayAdapter's matching/display
// (both driven by toString()) show the worker's name without exposing the
// Room entity's raw field dump, while still letting the item-click callback
// pull back the exact Worker instance the operator tapped — see
// selectedBindingWorker and confirmBinding() below for why identity (not
// just the displayed name) matters here.
private data class WorkerOption(val worker: Worker) {
    override fun toString(): String = worker.fullName
}

class MainActivity : BaseActivity() {

    companion object {
        private const val PREF_NAME = "esta_prefs"
        private const val KEY_EVENT_MODE = "event_mode"
        private const val MODE_CHECK_IN = "CHECK_IN"
        private const val MODE_CHECK_OUT = "CHECK_OUT"

        // Re-reading the exact same tag within this window is treated as one
        // physical tap re-polled by the NFC radio, not a second intentional
        // scan — without this, a card left near the reader a moment too long
        // could log duplicate CHECK_IN/CHECK_OUT rows.
        private const val SCAN_DEBOUNCE_MS = 3_000L
        private const val LOCATION_FIX_TIMEOUT_MS = 6_000L

        // How often (in 30s periodic-sync ticks) to purge old local history.
        // ~4 ticks (2 min) for the worker/card roster, ~240 ticks (2 hours)
        // for the history purge — that data changes far less often and the
        // purge itself is a single DELETE, no need to run it more.
        private const val WORKER_RESYNC_EVERY_N_TICKS = 4
        private const val HISTORY_PURGE_EVERY_N_TICKS = 240
    }

    // Must be registered unconditionally at activity init (not inside
    // onCreate's conditional setup-done branch) — ActivityResultLauncher
    // requires registration before the activity reaches STARTED.
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* no-op: requireLocationForScan() re-checks the grant on every scan */ }

    private fun hasLocationPermission(): Boolean {
        val fineGranted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fineGranted || coarseGranted
    }

    private fun requestLocationPermissionIfNeeded() {
        if (!hasLocationPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    private fun enabledLocationProviders(locationManager: LocationManager): List<String> {
        val fineGranted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val providers = if (fineGranted) {
            listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        } else {
            listOf(LocationManager.NETWORK_PROVIDER)
        }

        return try {
            providers
                .filter { provider -> locationManager.isProviderEnabled(provider) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun lastKnownLocation(
        locationManager: LocationManager,
        providers: List<String>
    ): Pair<Double, Double>? {
        return try {
            providers
                .mapNotNull { locationManager.getLastKnownLocation(it) }
                .maxByOrNull { it.time }
                ?.let { it.latitude to it.longitude }
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun awaitCurrentLocation(
        locationManager: LocationManager,
        providers: List<String>
    ): Pair<Double, Double>? = withTimeoutOrNull(LOCATION_FIX_TIMEOUT_MS) {
        suspendCancellableCoroutine { continuation ->
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    runCatching { locationManager.removeUpdates(this) }
                    if (continuation.isActive) {
                        continuation.resume(location.latitude to location.longitude)
                    }
                }
            }

            var registered = false
            providers.forEach { provider ->
                try {
                    locationManager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
                    registered = true
                } catch (e: Exception) {
                    android.util.Log.w("MainActivity", "Could not request $provider location: ${e.message}")
                }
            }

            if (!registered && continuation.isActive) {
                continuation.resume(null)
            }

            continuation.invokeOnCancellation {
                runCatching { locationManager.removeUpdates(listener) }
            }
        }
    }

    private suspend fun requireLocationForScan(): Pair<Double, Double>? {
        if (!hasLocationPermission()) {
            requestLocationPermissionIfNeeded()
            showLocationRequired(R.string.location_permission_required)
            return null
        }

        val locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (locationManager == null) {
            showLocationRequired(R.string.location_fix_required)
            return null
        }

        val providers = enabledLocationProviders(locationManager)
        if (providers.isEmpty()) {
            showLocationRequired(R.string.location_services_required)
            return null
        }

        val location = lastKnownLocation(locationManager, providers)
            ?: awaitCurrentLocation(locationManager, providers)

        if (location == null) {
            showLocationRequired(R.string.location_fix_required)
        }
        return location
    }

    private fun showLocationRequired(messageRes: Int) {
        val message = getString(messageRes)
        lastScannedUid = null
        lastScanTimeMs = 0L
        ScanFeedback.warning(this)
        nfcStatusText.text = getString(R.string.location_required_short)
        lastResultText.text = message
        lastResultText.visibility = View.VISIBLE
        cardLastResult.visibility = View.GONE
        bindingContainer.visibility = View.GONE
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private lateinit var toolbar: MaterialToolbar
    private lateinit var nfcStatusText: TextView
    private lateinit var tvTodayDate: TextView
    private lateinit var tvSyncBadge: TextView
    private lateinit var lastResultText: TextView

    private lateinit var tvTotalWorkers: TextView
    private lateinit var tvScannedToday: TextView
    private lateinit var bannerNotScanned: View
    private lateinit var tvBannerNotScanned: TextView

    private lateinit var cardModeCheckIn: MaterialCardView
    private lateinit var cardModeCheckOut: MaterialCardView
    private lateinit var tvArrowCheckIn: TextView
    private lateinit var tvArrowCheckOut: TextView
    private lateinit var tvModeCheckInLabel: TextView
    private lateinit var tvModeCheckOutLabel: TextView

    private lateinit var cardLastResult: MaterialCardView
    private lateinit var viewResultBar: View
    private lateinit var tvResultWorkerName: TextView
    private lateinit var tvResultEventType: TextView
    private lateinit var tvResultTime: TextView
    private lateinit var btnReportWrongCard: View

    private lateinit var bindingContainer: View
    private lateinit var tvBindingCardUid: TextView
    private lateinit var workerAutoComplete: AutoCompleteTextView
    private lateinit var btnConfirmBinding: View

    private lateinit var authOverlay: View
    private lateinit var btnUnlock: View

    private var nfcAdapter: NfcAdapter? = null
    private var pendingNfcIntent: PendingIntent? = null

    private val app by lazy { application as AttendanceApplication }
    private val apiService by lazy { app.createApiService() }
    private val repository by lazy { app.repository }
    private val syncManager by lazy { SyncManager(repository, apiService) }
    private val workerSyncManager by lazy {
        WorkerSyncManager(app.workerDao, app.cardDao, apiService)
    }

    private var periodicSyncJob: Job? = null
    private var lastScannedUid: String? = null
    private var lastScanTimeMs: Long = 0L
    private var lastResultWorkerName: String? = null
    private var allWorkersList: List<Worker> = emptyList()
    private var currentEventMode: String = MODE_CHECK_IN

    // Captured from workerAutoComplete's dropdown tap — the source of truth
    // for "who did the operator actually pick" when binding an unknown card.
    // Matching on the typed name string alone (the old behavior) silently
    // resolved to the WRONG worker whenever two workers share a full name —
    // it always picked whichever of them happened to come first in
    // allWorkersList, no matter which suggestion was tapped. Cleared
    // whenever the text is edited afterwards, so a stale pick is never
    // submitted for a name the operator has since changed.
    private var selectedBindingWorker: Worker? = null

    private val timeFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
    private val dateFmt = SimpleDateFormat("dd MMMM yyyy", Locale.getDefault())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE)
        if (!prefs.getBoolean("setup_done", false)) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        requestLocationPermissionIfNeeded()

        toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)

        val tenantName  = prefs.getString("tenant_name", null)
        val deviceLabel = prefs.getString("device_label", null)
        if (!tenantName.isNullOrBlank()) {
            supportActionBar?.title = tenantName
            supportActionBar?.subtitle = deviceLabel?.takeIf { it.isNotBlank() }
        }

        nfcStatusText   = findViewById(R.id.nfcStatusText)
        tvTodayDate     = findViewById(R.id.tvTodayDate)
        tvSyncBadge     = findViewById(R.id.tvSyncBadge)
        lastResultText  = findViewById(R.id.lastResultText)

        tvTotalWorkers    = findViewById(R.id.tvTotalWorkers)
        tvScannedToday    = findViewById(R.id.tvScannedToday)
        bannerNotScanned  = findViewById(R.id.bannerNotScanned)
        tvBannerNotScanned = findViewById(R.id.tvBannerNotScanned)

        cardModeCheckIn   = findViewById(R.id.cardModeCheckIn)
        cardModeCheckOut  = findViewById(R.id.cardModeCheckOut)
        tvArrowCheckIn    = findViewById(R.id.tvArrowCheckIn)
        tvArrowCheckOut   = findViewById(R.id.tvArrowCheckOut)
        tvModeCheckInLabel  = findViewById(R.id.tvModeCheckInLabel)
        tvModeCheckOutLabel = findViewById(R.id.tvModeCheckOutLabel)

        cardLastResult    = findViewById(R.id.cardLastResult)
        viewResultBar     = findViewById(R.id.viewResultBar)
        tvResultWorkerName = findViewById(R.id.tvResultWorkerName)
        tvResultEventType  = findViewById(R.id.tvResultEventType)
        tvResultTime       = findViewById(R.id.tvResultTime)
        btnReportWrongCard = findViewById(R.id.btnReportWrongCard)

        bindingContainer  = findViewById(R.id.bindingContainer)
        tvBindingCardUid  = findViewById(R.id.tvBindingCardUid)
        workerAutoComplete = findViewById(R.id.workerAutoComplete)
        btnConfirmBinding  = findViewById(R.id.btnConfirmBinding)

        authOverlay = findViewById(R.id.authOverlay)
        btnUnlock   = findViewById(R.id.btnUnlock)

        tvTodayDate.text = dateFmt.format(Date())

        currentEventMode = prefs.getString(KEY_EVENT_MODE, MODE_CHECK_IN) ?: MODE_CHECK_IN
        updateModeUI(currentEventMode)

        cardModeCheckIn.setOnClickListener {
            currentEventMode = MODE_CHECK_IN
            prefs.edit().putString(KEY_EVENT_MODE, MODE_CHECK_IN).apply()
            updateModeUI(MODE_CHECK_IN)
        }
        cardModeCheckOut.setOnClickListener {
            currentEventMode = MODE_CHECK_OUT
            prefs.edit().putString(KEY_EVENT_MODE, MODE_CHECK_OUT).apply()
            updateModeUI(MODE_CHECK_OUT)
        }

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            nfcStatusText.text = getString(R.string.nfc_unavailable)
        }

        pendingNfcIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_MUTABLE
        )

        // Update menu labels
        val lang = prefs.getString("language", "en") ?: "en"
        toolbar.menu?.findItem(R.id.action_language)?.title =
            when (lang) { "ru" -> "🌐 RU"; "tr" -> "🌐 TR"; else -> "🌐 EN" }

        val themeMode = prefs.getString("theme_mode", "dark") ?: "dark"
        toolbar.menu?.findItem(R.id.action_theme)?.title = when (themeMode) {
            "light"  -> getString(R.string.theme_light)
            "system" -> getString(R.string.theme_system)
            else     -> getString(R.string.theme_dark)
        }

        toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_sync     -> { triggerSync(); true }
                R.id.action_language -> { showLanguageDialog(); true }
                R.id.action_theme    -> { showThemeDialog(); true }
                R.id.action_setup    -> {
                    startActivity(Intent(this, SetupActivity::class.java))
                    true
                }
                R.id.action_shift_change -> {
                    startActivity(Intent(this, ShiftAssignmentActivity::class.java))
                    true
                }
                else -> false
            }
        }

        findViewById<View>(R.id.btnViewHistory).setOnClickListener {
            startActivity(Intent(this, AttendanceHistoryActivity::class.java))
        }

        findViewById<View>(R.id.btnSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        bannerNotScanned.setOnClickListener {
            startActivity(Intent(this, NotScannedActivity::class.java))
        }

        btnConfirmBinding.setOnClickListener { confirmBinding() }

        btnReportWrongCard.setOnClickListener {
            val intent = Intent(this, FixCardActivity::class.java).apply {
                putExtra(FixCardActivity.EXTRA_PREFILL_WORKER_NAME, lastResultWorkerName)
            }
            startActivity(intent)
        }

        btnUnlock.setOnClickListener { showBiometricPrompt() }

        // Selecting a dropdown suggestion always wins over whatever's typed —
        // parent.getItemAtPosition(position) reads from the adapter's
        // currently-*filtered* list, so this stays correct no matter how
        // the operator narrowed it down by typing first.
        workerAutoComplete.onItemClickListener =
            AdapterView.OnItemClickListener { parent, _, position, _ ->
                selectedBindingWorker = (parent.getItemAtPosition(position) as WorkerOption).worker
            }
        workerAutoComplete.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                // Any further edit invalidates the tapped selection — confirmBinding()
                // re-validates it against the current text anyway, but clearing it
                // here means a stale Worker is never even considered.
                if (selectedBindingWorker != null && s?.toString() != selectedBindingWorker?.fullName) {
                    selectedBindingWorker = null
                }
            }
        })

        lifecycleScope.launch {
            repository.allWorkers.collect { workers ->
                allWorkersList = workers
                val adapter = ArrayAdapter(
                    this@MainActivity,
                    android.R.layout.simple_dropdown_item_1line,
                    workers.map { WorkerOption(it) }
                )
                workerAutoComplete.setAdapter(adapter)
            }
        }

        syncWorkersFromServer()
        refreshShiftAlerts()

        // Cheap, and cold start is a good moment for it — catches devices
        // that were reinstalled or updated without ever passing through a
        // 2-hour periodic tick.
        lifecycleScope.launch { repository.purgeOldSyncedEvents() }
    }

    override fun onStart() {
        super.onStart()
        if (!app.isAuthenticated) {
            authOverlay.visibility = View.VISIBLE
            showBiometricPrompt()
        } else {
            authOverlay.visibility = View.GONE
        }
    }

    private fun showBiometricPrompt() {
        val biometricManager = BiometricManager.from(this)
        val canAuth = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_WEAK or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            // No lock screen set up — allow access directly
            app.isAuthenticated = true
            authOverlay.visibility = View.GONE
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val prompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    app.isAuthenticated = true
                    authOverlay.visibility = View.GONE
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    // Keep overlay; user can tap the Unlock button to retry
                }
                override fun onAuthenticationFailed() {
                    // Individual attempt failed; OS handles retry internally
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_title))
            .setSubtitle(getString(R.string.biometric_subtitle))
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_WEAK or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        prompt.authenticate(promptInfo)
    }

    private fun updateModeUI(mode: String) {
        val isCheckIn    = mode == MODE_CHECK_IN
        val checkinColor  = ContextCompat.getColor(this, R.color.checkin_color)
        val checkoutColor = ContextCompat.getColor(this, R.color.checkout_color)
        val mutedColor    = ContextCompat.getColor(this, R.color.text_muted)
        val surfaceBg     = ContextCompat.getColor(this, R.color.bg_surface)
        val checkinBg     = ContextCompat.getColor(this, R.color.checkin_bg)
        val checkoutBg    = ContextCompat.getColor(this, R.color.checkout_bg)
        val borderColor   = ContextCompat.getColor(this, R.color.bg_border)

        cardModeCheckIn.setCardBackgroundColor(if (isCheckIn) checkinBg else surfaceBg)
        cardModeCheckIn.setStrokeColor(ColorStateList.valueOf(if (isCheckIn) checkinColor else borderColor))
        tvArrowCheckIn.setTextColor(if (isCheckIn) checkinColor else mutedColor)
        tvModeCheckInLabel.setTextColor(if (isCheckIn) checkinColor else mutedColor)

        cardModeCheckOut.setCardBackgroundColor(if (!isCheckIn) checkoutBg else surfaceBg)
        cardModeCheckOut.setStrokeColor(ColorStateList.valueOf(if (!isCheckIn) checkoutColor else borderColor))
        tvArrowCheckOut.setTextColor(if (!isCheckIn) checkoutColor else mutedColor)
        tvModeCheckOutLabel.setTextColor(if (!isCheckIn) checkoutColor else mutedColor)
    }

    private fun syncWorkersFromServer() {
        lifecycleScope.launch {
            val result = workerSyncManager.syncFromServer()
            if (result.isSuccess) {
                tvSyncBadge.text = "● ONLINE"
                tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_synced))
                val count = result.getOrDefault(0)
                if (count > 0) {
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.workers_synced, count),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } else {
                tvSyncBadge.text = "● OFFLINE"
                tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_pending))
                android.util.Log.e("MainActivity", "Worker sync failed: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.enableForegroundDispatch(this, pendingNfcIntent, null, null)
        // The device usually stays open at the gate all day and only reads its
        // worker/card roster once at cold start (see onCreate) — a fresh check
        // whenever the operator comes back to this screen catches up on any
        // card fixes made in the admin panel while the app sat idle.
        syncWorkersFromServer()
        refreshShiftAlerts()
        periodicSyncJob?.cancel()
        startPeriodicSync()
    }

    private fun startPeriodicSync() {
        periodicSyncJob = lifecycleScope.launch {
            var tick = 0
            while (true) {
                delay(30_000)
                tick++

                val result = syncManager.syncPendingEvents()
                if (result.isSuccess) {
                    val count = result.getOrDefault(0)
                    tvSyncBadge.text = if (count > 0) "● ONLINE ($count synced)" else "● ONLINE"
                    tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_synced))
                } else {
                    tvSyncBadge.text = "● OFFLINE"
                    tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_pending))
                }

                // Tenant-wide, so every device polling it shows the identical
                // not-scanned list — no per-device "who scanned" state to
                // keep in sync. Cheap enough to run every tick (~30s), and
                // this is exactly the freshness the cross-device banner needs.
                refreshShiftAlerts()

                // Worker/card roster changes far less often than attendance
                // events, so this only needs to run every few ticks (~2 min)
                // — but it still needs to run *periodically*, not just once at
                // startup. Without it, a card fixed in the admin panel's Card
                // Reports page keeps scanning as "unknown"/wrong on this
                // device until someone force-closes and reopens the app —
                // exactly the "static, not dynamic" recognition that was
                // reported.
                if (tick % WORKER_RESYNC_EVERY_N_TICKS == 0) {
                    workerSyncManager.syncFromServer()
                }

                // Same cadence as the worker resync (~2 min) — cheap enough
                // to send this often, and frequent enough that the admin
                // panel's device list reflects a dying battery or a growing
                // sync backlog well before it becomes an operator's problem.
                if (tick % WORKER_RESYNC_EVERY_N_TICKS == 0) {
                    DeviceHeartbeat.send(this@MainActivity, apiService, repository.getPendingEventCount())
                }

                // Keeps the local history table (and the search on
                // AttendanceHistoryActivity) from growing forever on a
                // device that's left running for weeks/months.
                if (tick % HISTORY_PURGE_EVERY_N_TICKS == 0) {
                    repository.purgeOldSyncedEvents()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
        periodicSyncJob?.cancel()
        periodicSyncJob = null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNfcIntent(intent)
    }

    private fun handleNfcIntent(intent: Intent) {
        val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
        tag?.let {
            val uid = it.id.joinToString(":") { byte -> "%02X".format(byte) }
            val now = System.currentTimeMillis()
            if (uid == lastScannedUid && now - lastScanTimeMs < SCAN_DEBOUNCE_MS) {
                // Same card re-read within the debounce window — ignore it
                // so we don't create a duplicate attendance event.
                return
            }
            lastScannedUid = uid
            lastScanTimeMs = now
            processAttendance(uid)
        }
    }

    private fun processAttendance(uid: String) {
        lifecycleScope.launch {
            val (lat, lng) = requireLocationForScan() ?: return@launch
            var result = repository.processCardTap(uid, currentEventMode, lat, lng)
            if (result == "UNKNOWN_CARD") {
                // Our local card/worker snapshot is only refreshed
                // periodically (see startPeriodicSync) — a card that was
                // *just* fixed or newly linked in the admin panel would
                // otherwise still read as unknown here for up to ~2 minutes.
                // One on-demand resync-and-retry closes that gap for the
                // common case of an operator re-tapping right after a fix.
                if (workerSyncManager.syncFromServer().isSuccess) {
                    result = repository.processCardTap(uid, currentEventMode, lat, lng)
                }
            }
            if (result == "UNKNOWN_CARD") {
                ScanFeedback.unknown(this@MainActivity)
                lastResultText.visibility = View.GONE
                cardLastResult.visibility = View.GONE
                tvBindingCardUid.text = uid
                workerAutoComplete.text.clear()
                selectedBindingWorker = null
                bindingContainer.visibility = View.VISIBLE
            } else {
                val parts = result.split(" - ")
                val workerName = parts.getOrElse(0) { result }
                val eventType  = parts.getOrElse(1) { currentEventMode }

                showResultCard(workerName, eventType)
                lastResultText.visibility = View.GONE
                bindingContainer.visibility = View.GONE

                val syncResult = syncManager.syncPendingEvents()
                if (syncResult.isSuccess) {
                    tvSyncBadge.text = "● ONLINE"
                    tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_synced))
                    val warns = syncManager.lastWarnings
                    if (warns.isNotEmpty()) {
                        ScanFeedback.warning(this@MainActivity)
                        val msg = warns.joinToString("\n") { w ->
                            val reason = when (w.type) {
                                "ALREADY_CHECKED_OUT" -> "eýýäm çykyş edilipdir, bu goşmaça (mesai) çykyş hasaba alyndy"
                                "ALREADY_CHECKED_IN" -> "eýýäm giriş edilipdir!"
                                "OUTSIDE_GEOFENCE" -> "bu skan admin tarapyndan bellenilen zolagyň daşynda edildi — barybir hasaba alyndy"
                                else -> "eýýäm giriş edilipdir!"
                            }
                            "⚠ ${w.workerName}: $reason"
                        }
                        Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                    } else {
                        ScanFeedback.success(this@MainActivity)
                    }
                } else {
                    ScanFeedback.success(this@MainActivity)
                    tvSyncBadge.text = "● OFFLINE"
                    tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_pending))
                    Toast.makeText(
                        this@MainActivity,
                        syncResult.exceptionOrNull()?.message ?: "sync error",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun showResultCard(workerName: String, eventType: String) {
        val isCheckIn = eventType == "CHECK_IN"
        val color = ContextCompat.getColor(
            this,
            if (isCheckIn) R.color.checkin_color else R.color.checkout_color
        )

        lastResultWorkerName = workerName

        tvResultWorkerName.text = workerName
        tvResultEventType.text  = if (isCheckIn) getString(R.string.check_in) else getString(R.string.check_out)
        tvResultEventType.setTextColor(color)
        tvResultTime.text = timeFmt.format(Date())
        viewResultBar.setBackgroundColor(color)

        btnReportWrongCard.visibility = View.VISIBLE
        cardLastResult.visibility = View.VISIBLE
    }

    private fun confirmBinding() {
        val uid = lastScannedUid
        if (uid == null) {
            Toast.makeText(this, getString(R.string.nfc_waiting), Toast.LENGTH_SHORT).show()
            return
        }

        val selectedName = workerAutoComplete.text.toString().trim()

        // Prefer the worker actually tapped in the dropdown. Falling back to
        // a name-only match is only safe when it's unique — two workers can
        // share a full name, and matching on text alone used to always
        // resolve to whichever of them came first in allWorkersList,
        // silently linking the card to the wrong person no matter which
        // suggestion the operator picked.
        val nameMatches = allWorkersList.filter { it.fullName == selectedName }
        val worker = selectedBindingWorker?.takeIf { it.fullName == selectedName }
            ?: nameMatches.singleOrNull()

        if (worker == null) {
            val message = if (nameMatches.size > 1) {
                getString(R.string.select_worker_ambiguous)
            } else {
                getString(R.string.select_worker)
            }
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            return
        }

        btnConfirmBinding.isEnabled = false
        lifecycleScope.launch {
            try {
                // Bind on the server first — it's the single source of truth,
                // and the only thing every other device's periodic resync
                // sees. Only once that succeeds do we mirror it into this
                // device's local Room DB, so a failed/offline call never
                // leaves a card working here but invisible everywhere else
                // (the bug the old report-and-wait-for-admin flow had: it
                // wrote locally first and only *hoped* the report made it).
                apiService.assignWorkerCard(
                    CardAssignRequest(cardUid = uid, workerId = worker.employeeNumber)
                )

                val card = com.esta.attendance.data.local.entity.Card(
                    workerId = worker.id, cardUid = uid, cardType = "NFC"
                )
                repository.registerCard(card)

                Toast.makeText(this@MainActivity, "${worker.fullName} — linked", Toast.LENGTH_SHORT).show()
                bindingContainer.visibility = View.GONE
                lastResultText.visibility = View.GONE
                workerAutoComplete.text.clear()
                selectedBindingWorker = null
                processAttendance(uid)
            } catch (e: Exception) {
                Toast.makeText(
                    this@MainActivity,
                    getString(R.string.bind_card_error),
                    Toast.LENGTH_LONG
                ).show()
            } finally {
                btnConfirmBinding.isEnabled = true
            }
        }
    }

    private fun refreshShiftAlerts() {
        lifecycleScope.launch {
            try {
                val response = apiService.getShiftAlerts()
                tvTotalWorkers.text = response.totalActive.toString()
                tvScannedToday.text = response.scannedToday.toString()

                val notScanned = response.day.workers.size + response.night.workers.size
                if (notScanned > 0) {
                    tvBannerNotScanned.text = getString(R.string.not_scanned_banner_title, notScanned)
                    bannerNotScanned.visibility = View.VISIBLE
                } else {
                    bannerNotScanned.visibility = View.GONE
                }
            } catch (e: Exception) {
                // Offline or server hiccup — leave whatever was last shown
                // rather than blanking the stats/banner on every failed poll.
                android.util.Log.w("MainActivity", "Could not refresh shift alerts: ${e.message}")
            }
        }
    }

    private fun triggerSync() {
        tvSyncBadge.text = "● ${getString(R.string.syncing)}"
        tvSyncBadge.setTextColor(ContextCompat.getColor(this, R.color.brand_primary))

        lifecycleScope.launch {
            val result = syncManager.syncPendingEvents()
            if (result.isSuccess) {
                val count = result.getOrDefault(0)
                tvSyncBadge.text = "● ONLINE ($count synced)"
                tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_synced))
                Toast.makeText(this@MainActivity, getString(R.string.sync_done), Toast.LENGTH_SHORT).show()
            } else {
                tvSyncBadge.text = "● OFFLINE"
                tvSyncBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.sync_pending))
                Toast.makeText(this@MainActivity, getString(R.string.sync_error), Toast.LENGTH_SHORT).show()
            }
        }
    }
}
