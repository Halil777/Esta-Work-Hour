package com.workhour.worker.ui.theme

import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf

enum class AppLanguage(val displayName: String, val flag: String) {
    EN("English",     "🇬🇧"),
    RU("Русский",     "🇷🇺"),
    TK("Türkmençe",   "🇹🇲"),
    TR("Türkçe",      "🇹🇷"),
    UZ("O'zbekcha",   "🇺🇿"),
    TG("Тоҷикӣ",      "🇹🇯"),
    HI("हिंदी",        "🇮🇳"),
    KK("Қазақша",     "🇰🇿"),
    KY("Кыргызча",    "🇰🇬"),
    ZH("中文",         "🇨🇳"),
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

    // ── Admin corrections ─────────────────────────────────────────────────────
    val adminEdited: String,
    val originalTime: String,
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

    adminEdited = "Admin edited", originalTime = "Original",
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

    adminEdited = "Изм. Администратор", originalTime = "Исходное",
)

// ─── Turkmen ──────────────────────────────────────────────────────────────────

val TkStrings = AppStrings(
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

    adminEdited = "Admin üýtgetdi", originalTime = "Asyl wagt",
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
    checkInTime = "Giriş Saati", checkIn = "Giriş", checkOut = "Çıkış",
    duration = "Süre", total = "Toplam", working = "Çalışıyor",
    waitingForScan = "NFC taraması bekleniyor…", lastSevenDays = "Son 7 Gün",
    ofShift = "% 8 saatlik vardiyadan", workingFor = "Çalışıyor",

    workCalendar = "İş Takvimi", daysPresent = "Gelen Günler", totalHours = "Toplam Saat",
    present = "Mevcut", partial = "Kısmi", noRecord = "Kayıt yok",
    noAttendanceRecorded = "Bu gün için devam kaydı yok", inProgress = "Devam Ediyor",
    dayHeaders = listOf("Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"),

    todaysScans = "Bugünün Taramaları", currentlyWorking = "Şu an çalışıyor",
    checkedOut = "Çıkış yapıldı", noScansToday = "Bugün tarama kaydedilmedi",
    noScansDesc = "NFC tarama olaylarınız burada görünecek",
    waitingCheckOut = "Çıkış taraması bekleniyor…", break_ = "Mola",

    workDetails = "İş Detayları", workerId = "Sicil Numarası", profession = "Meslek",
    brigade = "Ekip", shift = "Vardiya", workSystem = "Çalışma Sistemi", status = "Durum",
    account = "Hesap", role = "Rol", server = "Sunucu", day = "Gündüz", night = "Gece",
    signOutConfirmTitle = "Çıkış Yap",
    signOutConfirmText = "Çıkış yapmak istediğinizden emin misiniz?",

    language = "Dil", theme = "Tema", darkMode = "Karanlık", lightMode = "Aydınlık",
    appearance = "Görünüm", security = "Güvenlik",
    changePassword = "Şifre Değiştir", currentPassword = "Mevcut Şifre",
    newPassword = "Yeni Şifre", confirmPassword = "Şifreyi Onayla",
    updatePassword = "Şifreyi Güncelle",
    passwordChanged = "Şifre başarıyla değiştirildi",
    passwordsDoNotMatch = "Şifreler eşleşmiyor",
    passwordTooShort = "Şifre en az 4 karakter olmalıdır",
    wrongPassword = "Mevcut şifre yanlış",
    about = "Hakkında", appVersion = "Versiyon 1.1",

    signInWithCredentials = "İş bilgilerinizle giriş yapın",
    username = "Kullanıcı Adı", password = "Şifre",
    invalidCredentials = "Geçersiz kullanıcı adı veya şifre",
    serverUnreachable = "Sunucuya ulaşılamıyor. Adresi ve ağı kontrol edin.",
    workersOnlyWarning = "Bu uygulama yalnızca işçiler içindir.\nUstalar ve şefler WorkForce uygulamasını kullanın.",
    changeServer = "Sunucuyu değiştir",
    connectToWorkHour = "WorkHour'a Bağlan",
    enterServerAddress = "Yöneticinizin verdiği sunucu adresini girin",
    continue_ = "Devam Et",
    invalidServerAddress = "Lütfen geçerli bir sunucu adresi girin",
    addressMustStartHttp = "Adres http:// veya https:// ile başlamalıdır",

    adminEdited = "Admin düzenledi", originalTime = "Orijinal",
)

// ─── Uzbek ────────────────────────────────────────────────────────────────────

val UzStrings = AppStrings(
    home = "Bosh sahifa", calendar = "Taqvim", timeline = "Vaqt chizig'i",
    settings = "Sozlamalar", profile = "Profil",

    signIn = "Kirish", signOut = "Chiqish", retry = "Qayta urinish",
    cancel = "Bekor qilish", save = "Saqlash", refresh = "Yangilash",
    loading = "Yuklanmoqda…", noData = "Ma'lumot yo'q",

    goodMorning = "Xayrli tong,", goodAfternoon = "Xayrli kun,", goodEvening = "Xayrli kech,",

    checkedIn = "Kirish amalga oshirildi", dayComplete = "Kun tugadi", notCheckedIn = "Kirish amalga oshirilmadi",
    checkInTime = "Kirish vaqti", checkIn = "Kirish", checkOut = "Chiqish",
    duration = "Davomiyligi", total = "Jami", working = "Ishlayapti",
    waitingForScan = "NFC skanerlash kutilmoqda…", lastSevenDays = "So'nggi 7 kun",
    ofShift = "8 soatlik smenadan %", workingFor = "Ishlayapti",

    workCalendar = "Ish taqvimi", daysPresent = "Kelgan kunlar", totalHours = "Jami soat",
    present = "Keldi", partial = "Qisman", noRecord = "Yozuv yo'q",
    noAttendanceRecorded = "Bu kun uchun davomat yozilmagan", inProgress = "Davom etmoqda",
    dayHeaders = listOf("Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"),

    todaysScans = "Bugungi skanlar", currentlyWorking = "Hozir ishlayapti",
    checkedOut = "Chiqish amalga oshirildi", noScansToday = "Bugun skan yozilmadi",
    noScansDesc = "NFC skan hodisalaringiz bu yerda ko'rinadi",
    waitingCheckOut = "Chiqish skani kutilmoqda…", break_ = "Tanaffus",

    workDetails = "Ish ma'lumotlari", workerId = "Ishchi ID", profession = "Kasb",
    brigade = "Brigada", shift = "Smena", workSystem = "Ish tizimi", status = "Holat",
    account = "Hisob", role = "Rol", server = "Server", day = "Kunduzi", night = "Kechasi",
    signOutConfirmTitle = "Chiqish",
    signOutConfirmText = "Haqiqatan ham chiqishni xohlaysizmi?",

    language = "Til", theme = "Mavzu", darkMode = "Qorong'u", lightMode = "Yorug'",
    appearance = "Ko'rinish", security = "Xavfsizlik",
    changePassword = "Parolni o'zgartirish", currentPassword = "Joriy parol",
    newPassword = "Yangi parol", confirmPassword = "Parolni tasdiqlash",
    updatePassword = "Parolni yangilash",
    passwordChanged = "Parol muvaffaqiyatli o'zgartirildi",
    passwordsDoNotMatch = "Parollar mos kelmaydi",
    passwordTooShort = "Parol kamida 4 ta belgidan iborat bo'lishi kerak",
    wrongPassword = "Joriy parol noto'g'ri",
    about = "Dastur haqida", appVersion = "Versiya 1.1",

    signInWithCredentials = "Ish ma'lumotlaringiz bilan kiring",
    username = "Foydalanuvchi nomi", password = "Parol",
    invalidCredentials = "Noto'g'ri foydalanuvchi nomi yoki parol",
    serverUnreachable = "Serverga ulanib bo'lmadi. Manzil va tarmoqni tekshiring.",
    workersOnlyWarning = "Bu ilova faqat ishchilar uchun.\nUstalar va boshliqlar WorkForce ilovasini ishlating.",
    changeServer = "Serverni o'zgartirish",
    connectToWorkHour = "WorkHour ga ulaning",
    enterServerAddress = "Ma'muriyat bergan server manzilini kiriting",
    continue_ = "Davom etish",
    invalidServerAddress = "Iltimos, to'g'ri server manzilini kiriting",
    addressMustStartHttp = "Manzil http:// yoki https:// bilan boshlanishi kerak",

    adminEdited = "Admin tahrir qildi", originalTime = "Asl",
)

// ─── Tajik ────────────────────────────────────────────────────────────────────

val TgStrings = AppStrings(
    home = "Саҳифаи асосӣ", calendar = "Тақвим", timeline = "Ҷадвали вақт",
    settings = "Танзимот", profile = "Профил",

    signIn = "Воридшавӣ", signOut = "Баромад", retry = "Такрор кӯшиш",
    cancel = "Бекор кунед", save = "Захира кунед", refresh = "Навсозӣ",
    loading = "Борида истодааст…", noData = "Маълумот нест",

    goodMorning = "Саҳар хайр,", goodAfternoon = "Рӯзатон хайр,", goodEvening = "Шабатон хайр,",

    checkedIn = "Воридшавӣ анҷом ёфт", dayComplete = "Рӯз анҷом ёфт", notCheckedIn = "Воридшавӣ анҷом наёфт",
    checkInTime = "Вақти воридшавӣ", checkIn = "Воридшавӣ", checkOut = "Баромад",
    duration = "Давомнокӣ", total = "Ҷамъ", working = "Кор мекунад",
    waitingForScan = "Интизори скан NFC…", lastSevenDays = "7 рӯзи охир",
    ofShift = "% аз 8 соат", workingFor = "Кор мекунад",

    workCalendar = "Тақвими корӣ", daysPresent = "Рӯзҳои ҳузур", totalHours = "Ҷамъи соатҳо",
    present = "Ҳозир буд", partial = "Қисман", noRecord = "Сабт нест",
    noAttendanceRecorded = "Барои ин рӯз ҳузур сабт нашудааст", inProgress = "Дар ҷараён",
    dayHeaders = listOf("Ду", "Се", "Чо", "Па", "Ҷу", "Ша", "Як"),

    todaysScans = "Сканҳои имрӯз", currentlyWorking = "Ҳоло кор мекунад",
    checkedOut = "Баромад анҷом ёфт", noScansToday = "Имрӯз скан сабт нашуд",
    noScansDesc = "Рӯйдодҳои скани NFC шумо ин ҷо намоиш дода мешаванд",
    waitingCheckOut = "Интизори скани баромад…", break_ = "Истироҳат",

    workDetails = "Маълумоти корӣ", workerId = "Рақами корманд", profession = "Касб",
    brigade = "Бригада", shift = "Навбат", workSystem = "Системаи корӣ", status = "Ҳолат",
    account = "Ҳисоб", role = "Нақш", server = "Сервер", day = "Рӯзона", night = "Шабона",
    signOutConfirmTitle = "Баромад",
    signOutConfirmText = "Оё мехоҳед хориҷ шавед?",

    language = "Забон", theme = "Тема", darkMode = "Торик", lightMode = "Равшан",
    appearance = "Намуд", security = "Амниятнокӣ",
    changePassword = "Тағйири парол", currentPassword = "Пароли ҷорӣ",
    newPassword = "Пароли нав", confirmPassword = "Тасдиқи парол",
    updatePassword = "Навсозии парол",
    passwordChanged = "Парол бомуваффақият тағйир ёфт",
    passwordsDoNotMatch = "Паролҳо мувофиқат намекунанд",
    passwordTooShort = "Парол бояд ақалан 4 рамз дошта бошад",
    wrongPassword = "Пароли ҷорӣ нодуруст аст",
    about = "Дар бораи барнома", appVersion = "Версия 1.1",

    signInWithCredentials = "Бо маълумоти корӣ ворид шавед",
    username = "Номи корбар", password = "Парол",
    invalidCredentials = "Номи корбар ё парол нодуруст",
    serverUnreachable = "Серверро дастрас кардан имкон нест. Манзил ва шабакаро санҷед.",
    workersOnlyWarning = "Ин барнома танҳо барои коргарон аст.\nУстокорон ва сардорон аз барномаи WorkForce истифода кунанд.",
    changeServer = "Тағйири сервер",
    connectToWorkHour = "Ба WorkHour пайваст шавед",
    enterServerAddress = "Суроғаи сервери дода шуда аз ҷониби маъмур ворид кунед",
    continue_ = "Давом диҳед",
    invalidServerAddress = "Лутфан суроғаи дурусти сервер ворид кунед",
    addressMustStartHttp = "Суроға бояд бо http:// ё https:// оғоз шавад",

    adminEdited = "Маъмур ислоҳ кард", originalTime = "Аслӣ",
)

// ─── Hindi ────────────────────────────────────────────────────────────────────

val HiStrings = AppStrings(
    home = "होम", calendar = "कैलेंडर", timeline = "टाइमलाइन",
    settings = "सेटिंग्स", profile = "प्रोफ़ाइल",

    signIn = "साइन इन", signOut = "साइन आउट", retry = "पुनः प्रयास",
    cancel = "रद्द करें", save = "सहेजें", refresh = "रीफ्रेश",
    loading = "लोड हो रहा है…", noData = "कोई डेटा नहीं",

    goodMorning = "सुप्रभात,", goodAfternoon = "नमस्ते,", goodEvening = "शुभ संध्या,",

    checkedIn = "चेक-इन हो गया", dayComplete = "दिन पूरा", notCheckedIn = "चेक-इन नहीं हुआ",
    checkInTime = "चेक-इन समय", checkIn = "चेक इन", checkOut = "चेक आउट",
    duration = "अवधि", total = "कुल", working = "काम कर रहे हैं",
    waitingForScan = "NFC स्कैन की प्रतीक्षा…", lastSevenDays = "पिछले 7 दिन",
    ofShift = "8 घंटे की शिफ्ट का %", workingFor = "काम कर रहे हैं",

    workCalendar = "कार्य कैलेंडर", daysPresent = "उपस्थित दिन", totalHours = "कुल घंटे",
    present = "उपस्थित", partial = "आंशिक", noRecord = "कोई रिकॉर्ड नहीं",
    noAttendanceRecorded = "इस दिन के लिए कोई उपस्थिति दर्ज नहीं", inProgress = "जारी है",
    dayHeaders = listOf("सो", "मं", "बु", "गु", "शु", "श", "र"),

    todaysScans = "आज के स्कैन", currentlyWorking = "वर्तमान में काम कर रहे हैं",
    checkedOut = "चेक-आउट हो गया", noScansToday = "आज कोई स्कैन दर्ज नहीं",
    noScansDesc = "आपके NFC स्कैन इवेंट यहाँ दिखेंगे",
    waitingCheckOut = "चेक-आउट स्कैन की प्रतीक्षा…", break_ = "ब्रेक",

    workDetails = "कार्य विवरण", workerId = "कर्मचारी आईडी", profession = "पेशा",
    brigade = "ब्रिगेड", shift = "शिफ्ट", workSystem = "कार्य प्रणाली", status = "स्थिति",
    account = "खाता", role = "भूमिका", server = "सर्वर", day = "दिन", night = "रात",
    signOutConfirmTitle = "साइन आउट",
    signOutConfirmText = "क्या आप साइन आउट करना चाहते हैं?",

    language = "भाषा", theme = "थीम", darkMode = "डार्क", lightMode = "लाइट",
    appearance = "रूप", security = "सुरक्षा",
    changePassword = "पासवर्ड बदलें", currentPassword = "वर्तमान पासवर्ड",
    newPassword = "नया पासवर्ड", confirmPassword = "पासवर्ड की पुष्टि करें",
    updatePassword = "पासवर्ड अपडेट करें",
    passwordChanged = "पासवर्ड सफलतापूर्वक बदल दिया गया",
    passwordsDoNotMatch = "पासवर्ड मेल नहीं खाते",
    passwordTooShort = "पासवर्ड कम से कम 4 अक्षरों का होना चाहिए",
    wrongPassword = "वर्तमान पासवर्ड गलत है",
    about = "के बारे में", appVersion = "संस्करण 1.1",

    signInWithCredentials = "अपने कार्य क्रेडेंशियल से साइन इन करें",
    username = "उपयोगकर्ता नाम", password = "पासवर्ड",
    invalidCredentials = "अमान्य उपयोगकर्ता नाम या पासवर्ड",
    serverUnreachable = "सर्वर से कनेक्ट नहीं हो सका। पता और नेटवर्क जांचें।",
    workersOnlyWarning = "यह ऐप केवल कर्मचारियों के लिए है।\nफोरमैन और प्रमुख WorkForce ऐप का उपयोग करें।",
    changeServer = "सर्वर बदलें",
    connectToWorkHour = "WorkHour से कनेक्ट करें",
    enterServerAddress = "अपने व्यवस्थापक द्वारा दिया गया सर्वर पता दर्ज करें",
    continue_ = "जारी रखें",
    invalidServerAddress = "कृपया एक वैध सर्वर पता दर्ज करें",
    addressMustStartHttp = "पता http:// या https:// से शुरू होना चाहिए",

    adminEdited = "Admin ने संपादित किया", originalTime = "मूल",
)

// ─── Kazakh ───────────────────────────────────────────────────────────────────

val KkStrings = AppStrings(
    home = "Басты бет", calendar = "Күнтізбе", timeline = "Уақыт желісі",
    settings = "Параметрлер", profile = "Профиль",

    signIn = "Кіру", signOut = "Шығу", retry = "Қайталау",
    cancel = "Болдырмау", save = "Сақтау", refresh = "Жаңарту",
    loading = "Жүктелуде…", noData = "Деректер жоқ",

    goodMorning = "Қайырлы таң,", goodAfternoon = "Қайырлы күн,", goodEvening = "Қайырлы кеш,",

    checkedIn = "Кіру жасалды", dayComplete = "Күн аяқталды", notCheckedIn = "Кіру жасалмады",
    checkInTime = "Кіру уақыты", checkIn = "Кіру", checkOut = "Шығу",
    duration = "Ұзақтық", total = "Барлығы", working = "Жұмыс істеуде",
    waitingForScan = "NFC сканерлеу күтілуде…", lastSevenDays = "Соңғы 7 күн",
    ofShift = "8 сағаттық ауысымнан %", workingFor = "Жұмыс істеуде",

    workCalendar = "Жұмыс күнтізбесі", daysPresent = "Болған күндер", totalHours = "Барлық сағат",
    present = "Болды", partial = "Ішінара", noRecord = "Жазба жоқ",
    noAttendanceRecorded = "Бұл күн үшін қатысу жазылмаған", inProgress = "Орындалуда",
    dayHeaders = listOf("Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жк"),

    todaysScans = "Бүгінгі сканерлеулер", currentlyWorking = "Қазір жұмыс істеуде",
    checkedOut = "Шығу жасалды", noScansToday = "Бүгін сканерлеу жазылмады",
    noScansDesc = "NFC сканерлеу оқиғаларыңыз осында пайда болады",
    waitingCheckOut = "Шығу сканерлеуі күтілуде…", break_ = "Үзіліс",

    workDetails = "Жұмыс деректері", workerId = "Жұмысшы ID", profession = "Мамандық",
    brigade = "Бригада", shift = "Ауысым", workSystem = "Жұмыс жүйесі", status = "Мәртебе",
    account = "Есептік жазба", role = "Рөл", server = "Сервер", day = "Күндізгі", night = "Түнгі",
    signOutConfirmTitle = "Шығу",
    signOutConfirmText = "Шыққыңыз келетінін растайсыз ба?",

    language = "Тіл", theme = "Тақырып", darkMode = "Қараңғы", lightMode = "Жарық",
    appearance = "Сыртқы келбет", security = "Қауіпсіздік",
    changePassword = "Құпия сөзді өзгерту", currentPassword = "Ағымдағы құпия сөз",
    newPassword = "Жаңа құпия сөз", confirmPassword = "Құпия сөзді растау",
    updatePassword = "Құпия сөзді жаңарту",
    passwordChanged = "Құпия сөз сәтті өзгертілді",
    passwordsDoNotMatch = "Құпия сөздер сәйкес келмейді",
    passwordTooShort = "Құпия сөз кемінде 4 таңбадан тұруы керек",
    wrongPassword = "Ағымдағы құпия сөз қате",
    about = "Қолданба туралы", appVersion = "Нұсқа 1.1",

    signInWithCredentials = "Жұмыс деректеріңізбен кіріңіз",
    username = "Пайдаланушы аты", password = "Құпия сөз",
    invalidCredentials = "Пайдаланушы аты немесе құпия сөз қате",
    serverUnreachable = "Серверге қосылу мүмкін емес. Мекенжайды және желіні тексеріңіз.",
    workersOnlyWarning = "Бұл қолданба тек жұмысшылар үшін.\nШебер және бастықтар WorkForce қолданбасын пайдаланыңыз.",
    changeServer = "Серверді өзгерту",
    connectToWorkHour = "WorkHour-ға қосылу",
    enterServerAddress = "Әкімшіңіз берген сервер мекенжайын енгізіңіз",
    continue_ = "Жалғастыру",
    invalidServerAddress = "Жарамды сервер мекенжайын енгізіңіз",
    addressMustStartHttp = "Мекенжай http:// немесе https:// -мен басталуы керек",

    adminEdited = "Әкімші өзгертті", originalTime = "Бастапқы",
)

// ─── Kyrgyz ───────────────────────────────────────────────────────────────────

val KyStrings = AppStrings(
    home = "Башкы бет", calendar = "Жылнаама", timeline = "Убакыт сызыгы",
    settings = "Жөндөөлөр", profile = "Профиль",

    signIn = "Кирүү", signOut = "Чыгуу", retry = "Кайра аракет",
    cancel = "Жокко чыгаруу", save = "Сактоо", refresh = "Жаңыртуу",
    loading = "Жүктөлүүдө…", noData = "Маалымат жок",

    goodMorning = "Кутман эртең,", goodAfternoon = "Кутман күн,", goodEvening = "Кутман кеч,",

    checkedIn = "Кирүү аткарылды", dayComplete = "Күн аяктады", notCheckedIn = "Кирүү аткарылган жок",
    checkInTime = "Кирүү убактысы", checkIn = "Кирүү", checkOut = "Чыгуу",
    duration = "Узактыгы", total = "Бардыгы", working = "Иштеп жатат",
    waitingForScan = "NFC скандоо күтүлүүдө…", lastSevenDays = "Акыркы 7 күн",
    ofShift = "8 саатык сменадан %", workingFor = "Иштеп жатат",

    workCalendar = "Жумуш жылнаамасы", daysPresent = "Болгон күндөр", totalHours = "Бардык саат",
    present = "Болду", partial = "Жарым-жартылай", noRecord = "Жазуу жок",
    noAttendanceRecorded = "Бул күн үчүн катышуу жазылган жок", inProgress = "Аткарылууда",
    dayHeaders = listOf("Дш", "Шш", "Шр", "Бш", "Жм", "Иш", "Жк"),

    todaysScans = "Бүгүнкү скандар", currentlyWorking = "Азыр иштеп жатат",
    checkedOut = "Чыгуу аткарылды", noScansToday = "Бүгүн скан жазылган жок",
    noScansDesc = "NFC скандоо окуяларыңыз бул жерде көрүнөт",
    waitingCheckOut = "Чыгуу скандоосу күтүлүүдө…", break_ = "Тыныгуу",

    workDetails = "Жумуш маалыматтары", workerId = "Кызматкер ID", profession = "Кесип",
    brigade = "Бригада", shift = "Смена", workSystem = "Жумуш системасы", status = "Абал",
    account = "Каттоо эсеп", role = "Роль", server = "Сервер", day = "Күндүзгү", night = "Түнкү",
    signOutConfirmTitle = "Чыгуу",
    signOutConfirmText = "Чыгышты каалаганыңызды тастыктайсызбы?",

    language = "Тил", theme = "Тема", darkMode = "Күңүрт", lightMode = "Жарык",
    appearance = "Түр", security = "Коопсуздук",
    changePassword = "Сырсөздү өзгөртүү", currentPassword = "Учурдагы сырсөз",
    newPassword = "Жаңы сырсөз", confirmPassword = "Сырсөздү тастыктоо",
    updatePassword = "Сырсөздү жаңыртуу",
    passwordChanged = "Сырсөз ийгиликтүү өзгөртүлдү",
    passwordsDoNotMatch = "Сырсөздөр дал келбейт",
    passwordTooShort = "Сырсөз жок дегенде 4 белгиден турушу керек",
    wrongPassword = "Учурдагы сырсөз туура эмес",
    about = "Колдонмо жөнүндө", appVersion = "Версия 1.1",

    signInWithCredentials = "Жумуш дайындамаларыңыз менен кириңиз",
    username = "Колдонуучу аты", password = "Сырсөз",
    invalidCredentials = "Жараксыз колдонуучу аты же сырсөз",
    serverUnreachable = "Серверге туташуу мүмкүн эмес. Даректи жана тармакты текшериңиз.",
    workersOnlyWarning = "Бул колдонмо кызматкерлер үчүн гана.\nУстат жана жетекчилер WorkForce колдонмосун колдонсун.",
    changeServer = "Серверди өзгөртүү",
    connectToWorkHour = "WorkHour-го туташуу",
    enterServerAddress = "Администраторуңуз берген сервер дарегин киргизиңиз",
    continue_ = "Улантуу",
    invalidServerAddress = "Жарактуу сервер дарегин киргизиңиз",
    addressMustStartHttp = "Дарек http:// же https:// менен башталышы керек",

    adminEdited = "Админ оңдоду", originalTime = "Баштапкы",
)

// ─── Chinese ──────────────────────────────────────────────────────────────────

val ZhStrings = AppStrings(
    home = "主页", calendar = "日历", timeline = "时间线",
    settings = "设置", profile = "个人资料",

    signIn = "登录", signOut = "退出", retry = "重试",
    cancel = "取消", save = "保存", refresh = "刷新",
    loading = "加载中…", noData = "暂无数据",

    goodMorning = "早上好,", goodAfternoon = "下午好,", goodEvening = "晚上好,",

    checkedIn = "已签到", dayComplete = "今日完成", notCheckedIn = "未签到",
    checkInTime = "签到时间", checkIn = "签到", checkOut = "签退",
    duration = "时长", total = "合计", working = "工作中",
    waitingForScan = "等待NFC扫描…", lastSevenDays = "最近7天",
    ofShift = "8小时班次的%", workingFor = "工作中",

    workCalendar = "工作日历", daysPresent = "出勤天数", totalHours = "总小时数",
    present = "出勤", partial = "部分", noRecord = "无记录",
    noAttendanceRecorded = "当天无出勤记录", inProgress = "进行中",
    dayHeaders = listOf("一", "二", "三", "四", "五", "六", "日"),

    todaysScans = "今日扫描", currentlyWorking = "正在工作",
    checkedOut = "已签退", noScansToday = "今日暂无扫描记录",
    noScansDesc = "您的NFC扫描记录将显示在此处",
    waitingCheckOut = "等待签退扫描…", break_ = "休息",

    workDetails = "工作详情", workerId = "员工ID", profession = "职业",
    brigade = "班组", shift = "班次", workSystem = "工作制度", status = "状态",
    account = "账户", role = "角色", server = "服务器", day = "白班", night = "夜班",
    signOutConfirmTitle = "退出",
    signOutConfirmText = "确定要退出吗？",

    language = "语言", theme = "主题", darkMode = "深色", lightMode = "浅色",
    appearance = "外观", security = "安全",
    changePassword = "修改密码", currentPassword = "当前密码",
    newPassword = "新密码", confirmPassword = "确认密码",
    updatePassword = "更新密码",
    passwordChanged = "密码修改成功",
    passwordsDoNotMatch = "密码不匹配",
    passwordTooShort = "密码至少需要4个字符",
    wrongPassword = "当前密码不正确",
    about = "关于", appVersion = "版本 1.1",

    signInWithCredentials = "使用您的工作凭据登录",
    username = "用户名", password = "密码",
    invalidCredentials = "用户名或密码无效",
    serverUnreachable = "无法连接服务器。请检查地址和网络。",
    workersOnlyWarning = "此应用仅供工人使用。\n领班和主管请使用WorkForce应用。",
    changeServer = "更改服务器",
    connectToWorkHour = "连接到WorkHour",
    enterServerAddress = "请输入管理员提供的服务器地址",
    continue_ = "继续",
    invalidServerAddress = "请输入有效的服务器地址",
    addressMustStartHttp = "地址必须以http://或https://开头",

    adminEdited = "管理员已修改", originalTime = "原始",
)

// ─── Provider ─────────────────────────────────────────────────────────────────

fun stringsFor(lang: AppLanguage): AppStrings = when (lang) {
    AppLanguage.EN -> EnStrings
    AppLanguage.RU -> RuStrings
    AppLanguage.TK -> TkStrings
    AppLanguage.TR -> TrStrings
    AppLanguage.UZ -> UzStrings
    AppLanguage.TG -> TgStrings
    AppLanguage.HI -> HiStrings
    AppLanguage.KK -> KkStrings
    AppLanguage.KY -> KyStrings
    AppLanguage.ZH -> ZhStrings
}

val LocalStrings = compositionLocalOf<AppStrings> { EnStrings }
