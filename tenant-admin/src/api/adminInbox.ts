import { apiFetch } from './http';
import type { CardReport } from './cardReports';
import type { ExtraHoursRequest } from './extraHours';
import type { ScannerDevice } from './scannerDevices';

export type AdminInbox = {
  cardReports: CardReport[];
  extraHours: ExtraHoursRequest[];
  staleDevices: ScannerDevice[];
  counts: {
    cardReports: number;
    extraHours: number;
    staleDevices: number;
    total: number;
  };
};

export const adminInboxApi = {
  get: (): Promise<AdminInbox> => apiFetch('/admin/inbox'),
};
