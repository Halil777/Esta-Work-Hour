import { apiFetch } from './http'

export type GeofenceZone = {
  id: string
  tenantId: string
  scannerDeviceId: string | null
  label: string
  latitude: number
  longitude: number
  radiusMeters: number
  createdAt: string
}

export type GeofenceZoneInput = {
  label: string
  scannerDeviceId: string | null
  latitude: number
  longitude: number
  radiusMeters: number
}

export const geofenceApi = {
  list: (): Promise<GeofenceZone[]> => apiFetch('/admin/geofence-zones'),

  create: (data: GeofenceZoneInput): Promise<GeofenceZone> =>
    apiFetch('/admin/geofence-zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<GeofenceZoneInput>): Promise<GeofenceZone> =>
    apiFetch(`/admin/geofence-zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiFetch(`/admin/geofence-zones/${id}`, { method: 'DELETE' }),
}
