package com.workhour.worker.ui.theme

import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf

enum class AppLanguage(val displayName: String) {
    EN("English"),
    RU("Русский"),
    TR("Türkçe"),
}

@Stable
data class AppStrings(
    // ── Navigation tabs ──────────────────────────────────────────────────────
    val home: String,
    val calendar: String,
    val timeline: String,
    val settings: String,
    val profile: String,

    // ── Common ───────────────────────────────────────────────────────────────
    val signIn: String,
    val signOut: String,
    val retry: String,
    val cancel: String,
    val save: String,
    val refresh: String,
    val loading: String,
    val noData: String,

    // ── Greetings ────────────────────────────────────────────────────────────
    val goodMorning: String,
    val goodAfternoon: String,
    val goodEvening: String,

    // ── Home ─────────────────────────────────────────────────────────────────
    val checkedIn: String,
    val dayComplete: String,
    val notCheckedIn: String,
    val checkInTime: String,
    val checkIn: String,
    val checkOut: String,
    val duration: String,
    val total: String,
    val working: String,
    val waitingForScan: String,
    val lastSevenDays: String,
    val ofShift: String,           // "% of 8h shift"
    val workingFor: String,        // "Working for Xh Ym"

    // ── Calendar ─────────────────────────────────────────────────────────────
    val workCalendar: String,
    val daysPresent: String,
    val totalHours: String,
    val present: String,
    val partial: String,
    val noRecord: String,
    val noAttendanceRecorded: String,
    val inProgress: String,
    val dayHeaders: List<String>,  // Mon–Sun

    // ── Timeline ─────────────────────────────────────────────────────────────
    val todaysScans: String,
    val currentlyWorking: String,
    val checkedOut: String,
    val noScansToday: String,
    val noScansDesc: String,
    val waitingCheckOut: String,
    val break_: String,

    // ── Profile ──────────────────────────────────────────────────────────────
    val workDetails: String,
    val workerId: String,
    val profession: String,
    val brigade: String,
    val shift: String,
    val workSystem: String,
    val status: String,
    val account: String,
    val role: String,
    val server: String,
    val day: String,
    val night: String,
    val signOutConfirmTitle: String,
    val signOutConfirmText: String,

    // ── Settings ─────────────────────────────────────────────────────────────
    val language: String,
    val appearance: String,
    val security: String,
    val changePassword: String,
    val currentPassword: String,
    val newPassword: String,
    val confirmPassword: String,
    val updatePassword: String,
    val passwordChanged: String,
    val passwordsDoNotMatch: String,
    val passwordTooShort: String,
    val wrongPassword: String,
    val about: String,
    val appVersion: String,

    // ── Auth ─────────────────────────────────────────────────────────────────
    val signInWithCredentials: String,
    val username: String,
    val password: String,
    val invalidCredentials: String,
    val serverUnreachable: String,
    val workersOnlyWarning: String,
    val changeServer: String,
    val connectToWorkHour: String,
    val enterServerAddress: String,
    val continue_: String,
    val invalidServerAddress: String,
    val addressMustStartHttp: String,
)

// ─── English ──────────────────────────────────────────────────────────────────

val EnStrings = AppStrings(
    home = "Home", calendar = "Calendar", timeline = "Timeline",
    settings = "Settings", profile = "Profile",

    signIn = "Sign In", signOut = "Sign Out", retry = "Retry",
    cancel = "Cancel", save = "Save", refresh = "Refresh",
    loading = "Loading…", noData = "No data",

    goodMorning = "Good morning,", goodAfternoon = "Good afternoon,", goodEvening = "Good evening,",

    checkedIn = "Checked In", dayComplete = "Day Complete", notCheckedIn = "Not Checked In",
    checkInTime = "Check-in time", checkIn = "Check In", checkOut = "Check Out",
    duration = "Duration", total = "Total", working = "Working",
    waitingForScan = "Waiting for NFC scan…", lastSevenDays = "Last 7 Days",
    ofShift = "% of 8h shift", workingFor = "Working for",

    workCalendar = "Work Calendar", daysPresent = "Days Present", totalHours = "Total Hours",
    present = "Present", partial = "Partial", noRecord = "No record",
    noAttendanceRecorded = "No attendance recorded for this day", inProgress = "In Progress",
    dayHeaders = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),

    todaysScans = "Today's Scans", currentlyWorking = "Currently working",
    checkedOut = "Checked out", noScansToday = "No scans recorded today",
    noScansDesc = "Your NFC scan events will appear here",
    waitingCheckOut = "Waiting for check-out…", break_ = "Break",

    workDetails = "Work Details", workerId = "Worker ID", profession = "Profession",
    brigade = "Brigade", shift = "Shift", workSystem = "Work System", status = "Status",
    account = "Account", role = "Role", server = "Server", day = "Day", night = "Night",
    signOutConfirmTitle = "Sign Out",
    signOutConfirmText = "Are you sure you want to sign out?",

    language = "Language", appearance = "Appearance", security = "Security",
    changePassword = "Change Password", currentPassword = "Current Password",
    newPassword = "New Password", confirmPassword = "Confirm Password",
    updatePassword = "Update Password",
    passwordChanged = "Password changed successfully",
    passwordsDoNotMatch = "Passwords do not match",
    passwordTooShort = "Password must be at least 4 characters",
    wrongPassword = "Current password is incorrect",
    about = "About", appVersion = "Version 1.0",

    signInWithCredentials = "Sign in with your work credentials",
    username = "Username", password = "Password",
    invalidCredentials = "Invalid username or password",
    serverUnreachable = "Cannot reach server. Check address and network.",
    workersOnlyWarning = "This app is for workers only.\nForemen and site chiefs please use the WorkForce app.",
    changeServer = "Change server",
    connectToWorkHour = "Connect to WorkHour",
    enterServerAddress = "Enter the server address provided by your administrator",
    continue_ = "Continue",
    invalidServerAddress = "Please enter a valid server address",
    addressMustStartHttp = "Address must start with http:// or https://",
)

// ─── Russian ──────────────────────────────────────────────────────────────────

val RuStrings = AppStrings(
    home = "Главная", calendar = "Календарь", timeline = "График",
    settings = "Настройки", profile = "Профиль",

    signIn = "Войти", signOut = "Выйти", retry = "Повторить",
    cancel = "Отмена", save = "Сохранить", refresh = "Обновить",
    loading = "Загрузка…", noData = "Нет данных",

    goodMorning = "Доброе утро,", goodAfternoon = "Добрый день,", goodEvening = "Добрый вечер,",

    checkedIn = "Отмечен вход", dayComplete = "День завершён", notCheckedIn = "Вход не отмечен",
    checkInTime = "Время входа", checkIn = "Вход", checkOut = "Выход",
    duration = "Длительность", total = "Итого", working = "Работает",
    waitingForScan = "Ожидание NFC-сканирования…", lastSevenDays = "Последние 7 дней",
    ofShift = "% от 8ч смены", workingFor = "Работает",

    workCalendar = "Рабочий календарь", daysPresent = "Дней присутствия", totalHours = "Всего часов",
    present = "Присутствовал", partial = "Частично", noRecord = "Нет записи",
    noAttendanceRecorded = "За этот день нет данных посещаемости", inProgress = "В процессе",
    dayHeaders = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"),

    todaysScans = "Сканирования сегодня", currentlyWorking = "На работе",
    checkedOut = "Вышел", noScansToday = "Сегодня нет сканирований",
    noScansDesc = "Здесь появятся события NFC-сканирования",
    waitingCheckOut = "Ожидание выхода…", break_ = "Перерыв",

    workDetails = "Рабочие данные", workerId = "Табельный номер", profession = "Должность",
    brigade = "Бригада", shift = "Смена", workSystem = "Система работы", status = "Статус",
    account = "Аккаунт", role = "Роль", server = "Сервер", day = "День", night = "Ночь",
    signOutConfirmTitle = "Выход",
    signOutConfirmText = "Вы уверены, что хотите выйти?",

    language = "Язык", appearance = "Внешний вид", security = "Безопасность",
    changePassword = "Изменить пароль", currentPassword = "Текущий пароль",
    newPassword = "Новый пароль", confirmPassword = "Подтвердите пароль",
    updatePassword = "Обновить пароль",
    passwordChanged = "Пароль успешно изменён",
    passwordsDoNotMatch = "Пароли не совпадают",
    passwordTooShort = "Пароль должен содержать не менее 4 символов",
    wrongPassword = "Текущий пароль неверен",
    about = "О приложении", appVersion = "Версия 1.0",

    signInWithCredentials = "Войдите с рабочими данными",
    username = "Имя пользователя", password = "Пароль",
    invalidCredentials = "Неверное имя пользователя или пароль",
    serverUnreachable = "Сервер недоступен. Проверьте адрес и сеть.",
    workersOnlyWarning = "Это приложение только для рабочих.\nПрорабы и начальники участков используют приложение WorkForce.",
    changeServer = "Изменить сервер",
    connectToWorkHour = "Подключиться к WorkHour",
    enterServerAddress = "Введите адрес сервера от вашего администратора",
    continue_ = "Продолжить",
    invalidServerAddress = "Введите корректный адрес сервера",
    addressMustStartHttp = "Адрес должен начинаться с http:// или https://",
)

// ─── Turkish ──────────────────────────────────────────────────────────────────

val TrStrings = AppStrings(
    home = "Ana Sayfa", calendar = "Takvim", timeline = "Zaman Çizelgesi",
    settings = "Ayarlar", profile = "Profil",

    signIn = "Giriş Yap", signOut = "Çıkış Yap", retry = "Tekrar Dene",
    cancel = "İptal", save = "Kaydet", refresh = "Yenile",
    loading = "Yükleniyor…", noData = "Veri yok",

    goodMorning = "Günaydın,", goodAfternoon = "İyi günler,", goodEvening = "İyi akşamlar,",

    checkedIn = "Giriş Yapıldı", dayComplete = "Gün Tamamlandı", notCheckedIn = "Giriş Yapılmadı",
    checkInTime = "Giriş saati", checkIn = "Giriş", checkOut = "Çıkış",
    duration = "Süre", total = "Toplam", working = "Çalışıyor",
    waitingForScan = "NFC taraması bekleniyor…", lastSevenDays = "Son 7 Gün",
    ofShift = "% 8 saatlik vardiyadan", workingFor = "Çalışıyor",

    workCalendar = "Çalışma Takvimi", daysPresent = "Mevcut Günler", totalHours = "Toplam Saat",
    present = "Mevcut", partial = "Kısmi", noRecord = "Kayıt yok",
    noAttendanceRecorded = "Bu gün için devam kaydı bulunamadı", inProgress = "Devam Ediyor",
    dayHeaders = listOf("Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"),

    todaysScans = "Bugünkü Taramalar", currentlyWorking = "Çalışıyor",
    checkedOut = "Çıkış yapıldı", noScansToday = "Bugün tarama kaydedilmedi",
    noScansDesc = "NFC tarama olaylarınız burada görünecek",
    waitingCheckOut = "Çıkış bekleniyor…", break_ = "Mola",

    workDetails = "İş Bilgileri", workerId = "Sicil Numarası", profession = "Meslek",
    brigade = "Ekip", shift = "Vardiya", workSystem = "Çalışma Sistemi", status = "Durum",
    account = "Hesap", role = "Rol", server = "Sunucu", day = "Gündüz", night = "Gece",
    signOutConfirmTitle = "Çıkış Yap",
    signOutConfirmText = "Çıkış yapmak istediğinizden emin misiniz?",

    language = "Dil", appearance = "Görünüm", security = "Güvenlik",
    changePassword = "Şifre Değiştir", currentPassword = "Mevcut Şifre",
    newPassword = "Yeni Şifre", confirmPassword = "Şifre Onay",
    updatePassword = "Şifreyi Güncelle",
    passwordChanged = "Şifre başarıyla değiştirildi",
    passwordsDoNotMatch = "Şifreler eşleşmiyor",
    passwordTooShort = "Şifre en az 4 karakter olmalıdır",
    wrongPassword = "Mevcut şifre yanlış",
    about = "Hakkında", appVersion = "Sürüm 1.0",

    signInWithCredentials = "İş bilgilerinizle giriş yapın",
    username = "Kullanıcı Adı", password = "Şifre",
    invalidCredentials = "Geçersiz kullanıcı adı veya şifre",
    serverUnreachable = "Sunucuya ulaşılamıyor. Adres ve ağı kontrol edin.",
    workersOnlyWarning = "Bu uygulama yalnızca işçiler içindir.\nUstabaşı ve şantiye şefleri lütfen WorkForce uygulamasını kullanın.",
    changeServer = "Sunucuyu değiştir",
    connectToWorkHour = "WorkHour'a Bağlan",
    enterServerAddress = "Yöneticinizin verdiği sunucu adresini girin",
    continue_ = "Devam Et",
    invalidServerAddress = "Lütfen geçerli bir sunucu adresi girin",
    addressMustStartHttp = "Adres http:// veya https:// ile başlamalıdır",
)

val LocalStrings = compositionLocalOf<AppStrings> { EnStrings }
