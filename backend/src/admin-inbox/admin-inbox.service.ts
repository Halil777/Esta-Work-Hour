import { Injectable } from '@nestjs/common';
import { ExtraHoursService } from '../extra-hours/extra-hours.service';
import { ScannerDevicesService } from '../scanner-devices/scanner-devices.service';

// A device is nominally active but might actually be dead — the heartbeat
// (foreground loop) pings every ~2 min and the WorkManager backstop every
// 15 min, so no signal for 20+ min means something's wrong even though the
// device row is still marked isActive. Mirrors the same threshold used in
// the tenant-admin Scanner Devices page's own staleness badge.
const STALE_DEVICE_THRESHOLD_MS = 20 * 60_000;

@Injectable()
export class AdminInboxService {
  constructor(
    private readonly extraHoursService: ExtraHoursService,
    private readonly scannerDevicesService: ScannerDevicesService,
  ) {}

  /**
   * One aggregated "what needs my attention today" feed. Before this,
   * getting the same picture meant visiting Overtime and Scanner Devices
   * separately — this is the single call the Inbox page makes each time it
   * loads or refreshes.
   *
   * Card mismatches used to show up here too, as pending Card Reports
   * awaiting admin approval — that whole approve-from-admin workflow is
   * gone now. An operator clears and rebinds a wrong card directly from the
   * device's Settings screen, instantly and without an admin step; see the
   * Card History report page for the audit trail of those changes.
   */
  async getInbox(tenantId?: string) {
    // AdminJwtGuard always populates adminUser (or rejects the request
    // before this runs), so tenantId is present in practice — this guard is
    // just to satisfy strict typing and fail closed (nothing shown) rather
    // than crash if that ever isn't true.
    if (!tenantId) {
      return {
        extraHours: [],
        staleDevices: [],
        counts: { extraHours: 0, staleDevices: 0, total: 0 },
      };
    }

    const [extraHoursAll, devices] = await Promise.all([
      this.extraHoursService.getAllRequests({ tenantId }),
      this.scannerDevicesService.findAll(tenantId),
    ]);

    const extraHours = extraHoursAll.filter(r => r.status === 'pending' || r.status === 'seen');

    const now = Date.now();
    const staleDevices = devices.filter(d => {
      if (!d.isActive) return false;
      if (!d.lastSeenAt) return true;
      return now - new Date(d.lastSeenAt).getTime() > STALE_DEVICE_THRESHOLD_MS;
    });

    return {
      extraHours,
      staleDevices,
      counts: {
        extraHours: extraHours.length,
        staleDevices: staleDevices.length,
        total: extraHours.length + staleDevices.length,
      },
    };
  }
}
