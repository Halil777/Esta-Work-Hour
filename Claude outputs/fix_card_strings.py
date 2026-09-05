#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Replaces the old "Card report" string block (used by the deleted
CardReportActivity) with a new "Fix card" block (used by the new
FixCardActivity self-service unbind/rebind flow), across every locale's
strings.xml, and updates the report_wrong_card button label to match the
new destination screen.
"""
import re
import sys

BASE = "Attendance App/app/src/main/res"

LOCALES = {
    "values": {
        "report_wrong_card": "Fix Wrong Card",
        "settings_fix_card_title": "Fix Card Binding",
        "settings_fix_card_subtitle": "Unbind a wrong card, then rescan for the right worker",
        "fix_card_title": "Fix Card Binding",
        "fix_card_subtitle": "Find the worker holding the wrong card and unbind it. Then scan the card again to link it to the right worker.",
        "fix_card_search_hint": "Search worker…",
        "fix_card_current_card_label": "Currently linked card:",
        "fix_card_no_card": "No card linked",
        "fix_card_unbind_button": "Unbind Card",
        "fix_card_cancel": "Cancel",
        "fix_card_confirm_title": "Unbind card?",
        "fix_card_confirm_message": "Remove the card linked to %1$s? Scan the correct card again afterward to link it to the right worker.",
        "fix_card_confirm_yes": "Yes, unbind",
        "fix_card_confirm_no": "No",
        "fix_card_success": "%1$s’s card was unbound. Scan the card again to link it to the right worker.",
        "fix_card_error": "Could not unbind card",
    },
    "values-ru": {
        "report_wrong_card": "Исправить привязку карты",
        "settings_fix_card_title": "Исправить привязку карты",
        "settings_fix_card_subtitle": "Отвязать неверную карту и привязать заново",
        "fix_card_title": "Исправить привязку карты",
        "fix_card_subtitle": "Найдите работника, к которому неверно привязана карта, и отвяжите её. Затем отсканируйте карту снова, чтобы привязать её к нужному работнику.",
        "fix_card_search_hint": "Поиск работника…",
        "fix_card_current_card_label": "Привязанная карта:",
        "fix_card_no_card": "Карта не привязана",
        "fix_card_unbind_button": "Отвязать карту",
        "fix_card_cancel": "Отмена",
        "fix_card_confirm_title": "Отвязать карту?",
        "fix_card_confirm_message": "Убрать карту, привязанную к %1$s? После этого отсканируйте нужную карту заново, чтобы привязать её к правильному работнику.",
        "fix_card_confirm_yes": "Да, отвязать",
        "fix_card_confirm_no": "Нет",
        "fix_card_success": "Карта работника %1$s отвязана. Отсканируйте карту снова, чтобы привязать её к нужному работнику.",
        "fix_card_error": "Не удалось отвязать карту",
    },
    "values-tr": {
        "report_wrong_card": "Kart Bağlantısını Düzelt",
        "settings_fix_card_title": "Kart Bağlantısını Düzelt",
        "settings_fix_card_subtitle": "Yanlış kartı kaldır ve yeniden bağla",
        "fix_card_title": "Kart Bağlantısını Düzelt",
        "fix_card_subtitle": "Yanlış kartın bağlı olduğu çalışanı bulun ve bağlantısını kaldırın. Ardından kartı tekrar okutarak doğru çalışana bağlayın.",
        "fix_card_search_hint": "Çalışan ara…",
        "fix_card_current_card_label": "Bağlı kart:",
        "fix_card_no_card": "Bağlı kart yok",
        "fix_card_unbind_button": "Kart Bağlantısını Kaldır",
        "fix_card_cancel": "İptal",
        "fix_card_confirm_title": "Kart bağlantısı kaldırılsın mı?",
        "fix_card_confirm_message": "%1$s işçisine bağlı kart kaldırılsın mı? Ardından doğru çalışana bağlamak için kartı tekrar okutun.",
        "fix_card_confirm_yes": "Evet, kaldır",
        "fix_card_confirm_no": "Hayır",
        "fix_card_success": "%1$s işçisinin kart bağlantısı kaldırıldı. Doğru çalışana bağlamak için kartı tekrar okutun.",
        "fix_card_error": "Kart bağlantısı kaldırılamadı",
    },
    "values-tk": {
        "report_wrong_card": "Kart baglanyşygyny düzet",
        "settings_fix_card_title": "Kart baglanyşygyny düzet",
        "settings_fix_card_subtitle": "Ýalňyş karty aýyryp, gaýtadan baglaň",
        "fix_card_title": "Kart baglanyşygyny düzet",
        "fix_card_subtitle": "Ýalňyş kart bagly bolan işçini tapyň we ony aýyryň. Soňra karty gaýtadan skanirläp, dogry işçä baglaň.",
        "fix_card_search_hint": "Işçini gözläň…",
        "fix_card_current_card_label": "Bagly kart:",
        "fix_card_no_card": "Bagly kart ýok",
        "fix_card_unbind_button": "Karty aýyr",
        "fix_card_cancel": "Ýatyr et",
        "fix_card_confirm_title": "Kart aýrylsynmy?",
        "fix_card_confirm_message": "%1$s işçisine bagly kart aýrylsynmy? Soňra dogry işçä baglamak üçin karty gaýtadan skanirläň.",
        "fix_card_confirm_yes": "Hawa, aýyr",
        "fix_card_confirm_no": "Ýok",
        "fix_card_success": "%1$s işçisiniň karty aýryldy. Dogry işçä baglamak üçin karty gaýtadan skanirläň.",
        "fix_card_error": "Karty aýryp bolmady",
    },
    "values-hi": {
        "report_wrong_card": "कार्ड लिंक ठीक करें",
        "settings_fix_card_title": "कार्ड लिंक ठीक करें",
        "settings_fix_card_subtitle": "गलत कार्ड अनलिंक करें और फिर से लिंक करें",
        "fix_card_title": "कार्ड लिंक ठीक करें",
        "fix_card_subtitle": "उस कर्मचारी को खोजें जिससे गलत कार्ड जुड़ा है और उसे अनलिंक करें। फिर सही कर्मचारी से जोड़ने के लिए कार्ड को फिर से स्कैन करें।",
        "fix_card_search_hint": "कर्मचारी खोजें…",
        "fix_card_current_card_label": "जुड़ा हुआ कार्ड:",
        "fix_card_no_card": "कोई कार्ड लिंक नहीं है",
        "fix_card_unbind_button": "कार्ड अनलिंक करें",
        "fix_card_cancel": "रद्द करें",
        "fix_card_confirm_title": "कार्ड अनलिंक करें?",
        "fix_card_confirm_message": "%1$s से जुड़ा कार्ड हटाएं? इसके बाद सही कर्मचारी से जोड़ने के लिए कार्ड को फिर से स्कैन करें।",
        "fix_card_confirm_yes": "हां, अनलिंक करें",
        "fix_card_confirm_no": "नहीं",
        "fix_card_success": "%1$s का कार्ड अनलिंक कर दिया गया है। सही कर्मचारी से जोड़ने के लिए कार्ड को फिर से स्कैन करें।",
        "fix_card_error": "कार्ड अनलिंक नहीं किया जा सका",
    },
    "values-kk": {
        "report_wrong_card": "Карта байланысын түзету",
        "settings_fix_card_title": "Карта байланысын түзету",
        "settings_fix_card_subtitle": "Қате картаны ажыратып, қайта байланыстырыңыз",
        "fix_card_title": "Карта байланысын түзету",
        "fix_card_subtitle": "Қате карта байланысқан қызметкерді тауып, оны ажыратыңыз. Содан кейін картаны қайта сканерлеп, дұрыс қызметкерге байланыстырыңыз.",
        "fix_card_search_hint": "Қызметкерді іздеу…",
        "fix_card_current_card_label": "Байланысқан карта:",
        "fix_card_no_card": "Байланысқан карта жоқ",
        "fix_card_unbind_button": "Картаны ажырату",
        "fix_card_cancel": "Болдырмау",
        "fix_card_confirm_title": "Карта ажыратылсын ба?",
        "fix_card_confirm_message": "%1$s қызметкеріне байланысқан карта алынып тасталсын ба? Содан кейін дұрыс қызметкерге байланыстыру үшін картаны қайта сканерлеңіз.",
        "fix_card_confirm_yes": "Иә, ажырату",
        "fix_card_confirm_no": "Жоқ",
        "fix_card_success": "%1$s қызметкерінің картасы ажыратылды. Дұрыс қызметкерге байланыстыру үшін картаны қайта сканерлеңіз.",
        "fix_card_error": "Картаны ажырату мүмкін болмады",
    },
    "values-tg": {
        "report_wrong_card": "Пайвасти кортро ислоҳ кунед",
        "settings_fix_card_title": "Пайвасти кортро ислоҳ кунед",
        "settings_fix_card_subtitle": "Корти нодурустро канда, аз нав пайваст кунед",
        "fix_card_title": "Пайвасти кортро ислоҳ кунед",
        "fix_card_subtitle": "Кормандеро, ки корти нодуруст ба ӯ пайваст аст, ёбед ва онро кандаед. Сипас барои пайваст кардан ба корманди дуруст, кортро аз нав скан кунед.",
        "fix_card_search_hint": "Кормандро ҷустуҷӯ кунед…",
        "fix_card_current_card_label": "Корти пайвастшуда:",
        "fix_card_no_card": "Корт пайваст нест",
        "fix_card_unbind_button": "Корт кандан",
        "fix_card_cancel": "Бекор кунед",
        "fix_card_confirm_title": "Корт канда шавад?",
        "fix_card_confirm_message": "Корти пайваста ба %1$s хориҷ карда шавад? Пас аз он барои пайваст кардан ба корманди дуруст, кортро аз нав скан кунед.",
        "fix_card_confirm_yes": "Ҳа, кандан",
        "fix_card_confirm_no": "Не",
        "fix_card_success": "Корти корманд %1$s канда шуд. Барои пайваст кардан ба корманди дуруст, кортро аз нав скан кунед.",
        "fix_card_error": "Кандани корт имконпазир нашуд",
    },
    "values-uz": {
        "report_wrong_card": "Karta bog'lanishini tuzatish",
        "settings_fix_card_title": "Karta bog'lanishini tuzatish",
        "settings_fix_card_subtitle": "Noto'g'ri kartani uzib, qayta bog'lang",
        "fix_card_title": "Karta bog'lanishini tuzatish",
        "fix_card_subtitle": "Noto'g'ri karta ulangan ishchini toping va uni uzing. Keyin to'g'ri ishchiga ulash uchun kartani qayta skanerlang.",
        "fix_card_search_hint": "Ishchini qidirish…",
        "fix_card_current_card_label": "Ulangan karta:",
        "fix_card_no_card": "Ulangan karta yo'q",
        "fix_card_unbind_button": "Kartani uzish",
        "fix_card_cancel": "Bekor qilish",
        "fix_card_confirm_title": "Karta uzilsinmi?",
        "fix_card_confirm_message": "%1$s ishchisiga ulangan karta olib tashlansinmi? Shundan so'ng to'g'ri ishchiga ulash uchun kartani qayta skanerlang.",
        "fix_card_confirm_yes": "Ha, uzish",
        "fix_card_confirm_no": "Yo'q",
        "fix_card_success": "%1$s ishchisining kartasi uzildi. To'g'ri ishchiga ulash uchun kartani qayta skanerlang.",
        "fix_card_error": "Kartani uzib bo'lmadi",
    },
}

CARD_REPORT_KEYS = [
    "card_report_title", "card_report_subtitle", "card_report_current_worker",
    "card_report_suggest", "card_report_note_hint", "card_report_send",
    "card_report_sent", "card_report_error", "card_report_cancel",
]


def escape_xml_attr_text(s: str) -> str:
    # Content goes inside <string>...</string> (not an attribute), so only
    # the standard XML entity escapes are needed; apostrophes must still be
    # escaped for Android's resource-string parser.
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("'", "\\'")
    return s


def process(locale: str, values: dict) -> None:
    path = f"{BASE}/{locale}/strings.xml"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1) Update report_wrong_card text in place.
    new_text = escape_xml_attr_text(values["report_wrong_card"])
    content, n = re.subn(
        r'(<string name="report_wrong_card">).*?(</string>)',
        lambda m: m.group(1) + new_text + m.group(2),
        content,
        count=1,
    )
    if n != 1:
        raise RuntimeError(f"{path}: report_wrong_card not found/updated")

    # 2) Remove the old "Card report" comment + its string entries.
    #    Matches the comment line and every card_report_* string line that
    #    immediately follows it, however many of the 9 keys are present.
    block_pattern = re.compile(
        r'[ \t]*<!--[^\n]*[Cc]ard report[^\n]*-->\n'
        r'(?:[ \t]*<string name="card_report_[a-z_]+">.*?</string>\n)+',
    )
    new_block_lines = ["    <!-- Fix card (self-service unbind/rebind) -->\n"]
    fix_keys = [
        "fix_card_title", "fix_card_subtitle", "fix_card_search_hint",
        "fix_card_current_card_label", "fix_card_no_card", "fix_card_unbind_button",
        "fix_card_cancel", "fix_card_confirm_title", "fix_card_confirm_message",
        "fix_card_confirm_yes", "fix_card_confirm_no", "fix_card_success", "fix_card_error",
    ]
    for key in fix_keys:
        new_block_lines.append(
            f'    <string name="{key}">{escape_xml_attr_text(values[key])}</string>\n'
        )
    new_block = "".join(new_block_lines)

    content, n = block_pattern.subn(new_block, content, count=1)
    if n != 1:
        raise RuntimeError(f"{path}: card_report block not found/removed (matched {n} times)")

    # Sanity: no leftover card_report_* keys.
    for key in CARD_REPORT_KEYS:
        if key in content:
            raise RuntimeError(f"{path}: leftover key {key} still present")

    # 3) Add the two Settings-row strings next to the existing settings_* block.
    settings_marker = '<string name="settings_language_title">'
    idx = content.find(settings_marker)
    if idx == -1:
        raise RuntimeError(f"{path}: settings_language_title marker not found")
    line_end = content.find("\n", idx)
    if line_end == -1:
        raise RuntimeError(f"{path}: could not find end of settings_language_title line")
    insertion = (
        f'\n    <string name="settings_fix_card_title">{escape_xml_attr_text(values["settings_fix_card_title"])}</string>'
        f'\n    <string name="settings_fix_card_subtitle">{escape_xml_attr_text(values["settings_fix_card_subtitle"])}</string>'
    )
    content = content[:line_end] + insertion + content[line_end:]

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK  {path}")


def main():
    for locale, values in LOCALES.items():
        process(locale, values)


if __name__ == "__main__":
    main()
