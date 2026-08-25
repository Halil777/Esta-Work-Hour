export const todayIso = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

export const fmtTime = (timestamp: number | null | undefined) => {
  if (!timestamp) return null;

  return new Date(timestamp).toLocaleString("tr-TR", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Hour/minute unit suffixes are passed in by the caller (sourced from the
// active tr/en/ru translation set) so this stays language-neutral — never a
// hardcoded Turkmen or other unsupported-language string.
export const fmtHours = (
  milliseconds: number | null | undefined,
  units: { h: string; min: string } = { h: 'h', min: 'min' },
) => {
  if (!milliseconds || milliseconds <= 0) return null;

  const totalMinutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} ${units.min}`;
  if (minutes === 0) return `${hours} ${units.h}`;

  return `${hours} ${units.h} ${minutes} ${units.min}`;
};

export const fmtSendAt = (
  iso: string | null | undefined,
  noneLabel = 'None scheduled',
) => {
  if (!iso) return noneLabel;

  return new Date(iso).toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "-";

  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtToplamSaat = (
  milliseconds: number | null | undefined,
  mesai: string | undefined,
  units: { h: string; min: string } = { h: 'h', min: 'min' },
) => {
  if (mesai === "Aylık") return `8 ${units.h}`;
  return fmtHours(milliseconds, units) ?? "-";
};
