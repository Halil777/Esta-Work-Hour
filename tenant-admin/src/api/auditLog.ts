import { apiFetch } from './http';

export interface AuditLogRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string;
  before: any;
  after: any;
  changedAt: string;
}

export const auditLogApi = {
  list: (limit = 500): Promise<AuditLogRecord[]> =>
    apiFetch(`/audit-logs?limit=${limit}`),
};
