export const todayIso = () => new Date().toISOString().split('T')[0]

export const fmtTime = (timestamp: number | null | undefined) => {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const fmtHours = (milliseconds: number | null | undefined) => {
  if (!milliseconds || milliseconds <= 0) return null

  const totalMinutes = Math.round(milliseconds / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} sag`
  return `${hours} sag ${minutes} min`
}

export const fmtSendAt = (iso: string | null | undefined) => {
  if (!iso) return 'Nobat ýok'
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const fmtToplamSaat = (milliseconds: number | null | undefined, mesai: string | undefined) => {
  if (mesai === 'Aylık') return '8 sag'
  return fmtHours(milliseconds) ?? '-'
}
