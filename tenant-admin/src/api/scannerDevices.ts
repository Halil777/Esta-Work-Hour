import { apiFetch } from './http';

export type ScannerDevice = {
  id: string;
  tenantId: string;
  label: string;
  tokenPrefix: string;
  workerEntityId: string | null;
  operatorName: string | null;
  location: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  batteryLevel: number | null;
  appVersion: string | null;
  pendingEventCount: number | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  // Per-device (= per-operator) scan counts — how many distinct workers this
  // device has recorded a scan for, all-time and today, plus the raw event
  // counts. Absent/zero for events synced before this tracking existed.
  totalWorkersScanned: number;
  todayWorkersScanned: number;
  totalScans: number;
  todayScans: number;
};

export type ScanSummary = {
  totalWorkersEverScanned: number;
  todayWorkersScanned: number;
};

export type CreateScannerDevicePayload = {
  label: string;
  workerEntityId?: string | null;
  location?: string | null;
};

export type UpdateScannerDevicePayload = {
  label?: string;
  workerEntityId?: string | null;
  location?: string | null;
  isActive?: boolean;
};

export const scannerDevicesApi = {
  getAll: (): Promise<ScannerDevice[]> =>
    apiFetch('/admin/scanner-devices'),

  getScanSummary: (): Promise<ScanSummary> =>
    apiFetch('/admin/scanner-devices/scan-summary'),

  getToken: (id: string): Promise<{ token: string }> =>
    apiFetch(`/admin/scanner-devices/${id}/token`),

  create: (data: CreateScannerDevicePayload): Promise<ScannerDevice & { token: string }> =>
    apiFetch('/admin/scanner-devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateScannerDevicePayload): Promise<ScannerDevice> =>
    apiFetch(`/admin/scanner-devices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  regenerateToken: (id: string): Promise<{ token: string }> =>
    apiFetch(`/admin/scanner-devices/${id}/regenerate-token`, { method: 'POST' }),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiFetch(`/admin/scanner-devices/${id}`, { method: 'DELETE' }),
};
