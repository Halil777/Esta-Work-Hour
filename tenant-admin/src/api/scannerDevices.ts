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
