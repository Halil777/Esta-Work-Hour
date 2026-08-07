package com.workhour.worker.ui.theme

import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf

enum class AppLanguage(val displayName: String, val flag: String) {
    EN("English", "🇬🇧"),
    RU("Русский", "🇷🇺"),
    TR("Türkçe", "🇹🇲"),
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
    val ofShift: String,
    val workingFor: String,

    // ── Calendar ─────────────────────────────────────────────────────────────
    val workCalendar: String,
    val daysPresent: String,
    val totalHours: String,
    val present: String,
    val partial: String,
    val noRecord: String,
    val noAttendanceRecorded: String,
    val inProgress: String,
    val dayHeaders: List<String>,

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
    val theme: String,
    val darkMode: String,
    val lightMode: String,
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

    language = "Language", theme = "Theme", darkMode = "Dark", lightMode = "Light",
    appearance = "Appearance", security = "Security",
    changePassword = "Change Password", currentPassword = "Current Password",
    newPassword = "New Password", confirmPassword = "Confirm Password",
    updatePassword = "Update Password",
    passwordChanged = "Password changed successfully",
    passwordsDoNotMatch = "Passwords do not match",
    passwordTooShort = "Password must be at least 4 characters",
    wrongPassword = "Current password is incorrect",
    about = "About", appVersion = "Version 1.1",

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

    language = "Язык", theme = "Тема", darkMode = "Тёмная", lightMode = "Светлая",
    appearance = "Внешний вид", security = "Безопасность",
    changePassword = "Изменить пароль", currentPassword = "Текущий пароль",
    newPassword = "Новый пароль", confirmPassword = "Подтвердите пароль",
    updatePassword = "Обновить пароль",
    passwordChanged = "Пароль успешно изменён",
    passwordsDoNotMatch = "Пароли не совпадают",
    passwordTooShort = "Пароль должен содержать не менее 4 символов",
    wrongPassword = "Текущий пароль неверен",
    about = "О приложении", appVersion = "Версия 1.1",

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

// ─── Turkmen ──────────────────────────────────────────────────────────────────

val TrStrings = AppStrings(
    home = "Baş sahypa", calendar = "Senenama", timeline = "Skan lenti",
    settings = "Sazlamalar", profile = "Profil",

    signIn = "Giriş et", signOut = "Çykyş et", retry = "Täzeden synap gör",
    cancel = "Ýatyr", save = "Sakla", refresh = "Täzele",
    loading = "Ýüklenýär…", noData = "Maglumat ýok",

    goodMorning = "Ertiriň haýyrly bolsun,", goodAfternoon = "Günüň haýyrly bolsun,", goodEvening = "Agşamyň haýyrly bolsun,",

    checkedIn = "Giriş edildi", dayComplete = "Gün tamamlandy", notCheckedIn = "Giriş edilmedi",
    checkInTime = "Giriş wagty", checkIn = "Giriş", checkOut = "Çykyş",
    duration = "Dowam", total = "Jemi", working = "Işleýär",
    waitingForScan = "NFC skany garaşylýar…", lastSevenDays = "Soňky 7 gün",
    ofShift = "% 8 sagat çalşykdan", workingFor = "Işleýär",

    workCalendar = "Iş senenamasy", daysPresent = "Gelen günler", totalHours = "Jemi sagat",
    present = "Geldi", partial = "Bölekleýin", noRecord = "Maglumat ýok",
    noAttendanceRecorded = "Bu gün üçin gatnaşyk ýazgysy ýok", inProgress = "Dowam edýär",
    dayHeaders = listOf("Db", "Sl", "Çr", "Pb", "An", "Şb", "Ýk"),

    todaysScans = "Şu günki skanlar", currentlyWorking = "Häzir işleýär",
    checkedOut = "Çykyş edildi", noScansToday = "Şu gün skan ýazgylanmady",
    noScansDesc = "NFC skan wakalaryňyz bu ýerde görüner",
    waitingCheckOut = "Çykyş skany garaşylýar…", break_ = "Arakesme",

    workDetails = "Iş maglumatlary", workerId = "Sicil belgisi", profession = "Hünär",
    brigade = "Bölüm", shift = "Çalşyk", workSystem = "Iş ulgamy", status = "Ýagdaý",
    account = "Hasap", role = "Rol", server = "Serwer", day = "Gündizip", night = "Gijeki",
    signOutConfirmTitle = "Çykyş et",
    signOutConfirmText = "Çykmagy hakykatdan isleýärsiňizmi?",

    language = "Dil", theme = "Tema", darkMode = "Garaňky", lightMode = "Ýagty",
    appearance = "Görünüş", security = "Howpsuzlyk",
    changePassword = "Paroly üýtget", currentPassword = "Häzirki parol",
    newPassword = "Täze parol", confirmPassword = "Paroly tassykla",
    updatePassword = "Paroly täzele",
    passwordChanged = "Parol üstünlikli üýtgedildi",
    passwordsDoNotMatch = "Parollar gabat gelmeýär",
    passwordTooShort = "Parol azyndan 4 belgiden ybarat bolmaly",
    wrongPassword = "Häzirki parol nädogry",
    about = "Barada", appVersion = "Wersiýa 1.1",

    signInWithCredentials = "Iş maglumatlaňyz bilen giriş ediň",
    username = "Ulanyjy ady", password = "Parol",
    invalidCredentials = "Ulanyjy ady ýa-da parol nädogry",
    serverUnreachable = "Serwere bağlanyp bolmaýar. Adres we tory barlaň.",
    workersOnlyWarning = "Bu programma diňe işçiler üçindir.\nUstalar we ýolbaşçylar WorkForce programmasyny ulansyn.",
    changeServer = "Serweri üýtget",
    connectToWorkHour = "WorkHour-a bağlan",
    enterServerAddress = "Dolandyryjyňyzyň berlen serwer adresini giriziň",
    continue_ = "Dowam et",
    invalidServerAddress = "Dogry serwer adresini giriziň",
    addressMustStartHttp = "Adres http:// ýa-da https:// bilen başlamaly",
)

val LocalStrings = compositionLocalOf<AppStrings> { EnStrings }
