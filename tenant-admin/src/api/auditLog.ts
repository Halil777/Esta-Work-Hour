const BASE = '/api';

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
    fetch(`${BASE}/audit-logs?limit=${limit}`).then(r => {
      if (!r.ok) throw new Error(`Request failed: ${r.status}`);
      return r.json();
    }),
};
