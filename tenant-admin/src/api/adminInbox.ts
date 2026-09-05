import { apiFetch } from './http';
import type { ExtraHoursRequest } from './extraHours';
import type { ScannerDevice } from './scannerDevices';

export type AdminInbox = {
  extraHours: ExtraHoursRequest[];
  staleDevices: ScannerDevice[];
  counts: {
    extraHours: number;
    staleDevices: number;
    total: number;
  };
};

export const adminInboxApi = {
  get: (): Promise<AdminInbox> => apiFetch('/admin/inbox'),
};
