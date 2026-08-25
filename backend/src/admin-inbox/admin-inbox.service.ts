import { Injectable } from '@nestjs/common';
import { CardReportsService } from '../card-reports/card-reports.service';
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
    private readonly cardReportsService: CardReportsService,
    private readonly extraHoursService: ExtraHoursService,
    private readonly scannerDevicesService: ScannerDevicesService,
  ) {}

  /**
   * One aggregated "what needs my attention today" feed. Before this,
   * getting the same picture meant visiting Card Reports, Overtime, and
   * Scanner Devices separately — this is the single call the Inbox page
   * makes each time it loads or refreshes.
   */
  async getInbox(tenantId?: string) {
    // AdminJwtGuard always populates adminUser (or rejects the request
    // before this runs), so tenantId is present in practice — this guard is
    // just to satisfy strict typing and fail closed (nothing shown) rather
    // than crash if that ever isn't true.
    if (!tenantId) {
      return {
        cardReports: [],
        extraHours: [],
        staleDevices: [],
        counts: { cardReports: 0, extraHours: 0, staleDevices: 0, total: 0 },
      };
    }

    const [pendingCardReports, extraHoursAll, devices] = await Promise.all([
      this.cardReportsService.findAll(tenantId, 'pending'),
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
      cardReports: pendingCardReports,
      extraHours,
      staleDevices,
      counts: {
        cardReports: pendingCardReports.length,
        extraHours: extraHours.length,
        staleDevices: staleDevices.length,
        total: pendingCardReports.length + extraHours.length + staleDevices.length,
      },
    };
  }
}
