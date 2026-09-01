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

export type OperatorScanLogRow = {
  deviceId: string;
  deviceLabel: string;
  operatorName: string | null;
  date: string; // YYYY-MM-DD
  workerId: string;
  scanCount: number;
  firstScan: number;
  lastScan: number;
};

export type ScanLocationRow = {
  deviceId: string;
  deviceLabel: string;
  operatorName: string | null;
  employeeNumber: string;
  workerName: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT';
  eventTime: number;
  latitude: number;
  longitude: number;
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

  getOperatorLog: (startDate: string, endDate: string): Promise<OperatorScanLogRow[]> =>
    apiFetch(`/admin/scanner-devices/operator-log?startDate=${startDate}&endDate=${endDate}`),

  getScanLocations: (startDate?: string, endDate?: string): Promise<ScanLocationRow[]> => {
    const qs = new URLSearchParams();
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    const q = qs.toString();
    return apiFetch(`/admin/scanner-devices/scan-locations${q ? '?' + q : ''}`);
  },

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
