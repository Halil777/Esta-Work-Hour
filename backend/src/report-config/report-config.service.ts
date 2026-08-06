import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportConfig, ReportScheduleItem, MonthlySchedule, DashboardSchedule, AnomalySchedule } from './report-config.entity';

const DEFAULT_MONTHLY: MonthlySchedule = {
  enabled: false,
  time: '08:00',
  emails: [],
  lastSentMonth: null,
};

@Injectable()
export class ReportConfigService {
  constructor(
    @InjectRepository(ReportConfig)
    private readonly repo: Repository<ReportConfig>,
  ) {}

  private async getSingleton(tenantId?: string): Promise<ReportConfig> {
    // Look up by tenantId (null for legacy global singleton)
    const where: any = tenantId ? { tenantId } : { tenantId: null as any };
    let config = await this.repo.findOne({ where });
    if (!config) {
      config = this.repo.create({
        tenantId: tenantId ?? null,
        emailsJson: '[]',
        schedulesJson: '[]',
      });
      await this.repo.save(config);
    }
    return config;
  }

  async getConfig(tenantId?: string): Promise<{
    emails: string[];
    schedules: ReportScheduleItem[];
    monthlySchedule: MonthlySchedule;
  }> {
    const cfg = await this.getSingleton(tenantId);
    return {
      emails: JSON.parse(cfg.emailsJson),
      schedules: JSON.parse(cfg.schedulesJson),
      monthlySchedule: cfg.monthlyScheduleJson
        ? JSON.parse(cfg.monthlyScheduleJson)
        : DEFAULT_MONTHLY,
    };
  }

  async updateEmails(emails: string[], tenantId?: string): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    cfg.emailsJson = JSON.stringify(emails);
    await this.repo.save(cfg);
  }

  async updateSchedules(schedules: ReportScheduleItem[], tenantId?: string): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    cfg.schedulesJson = JSON.stringify(schedules);
    await this.repo.save(cfg);
  }

  async updateScheduleLastSent(scheduleId: string, date: string, tenantId?: string): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    const schedules: ReportScheduleItem[] = JSON.parse(cfg.schedulesJson);
    const idx = schedules.findIndex(s => s.id === scheduleId);
    if (idx !== -1) {
      schedules[idx].lastSentDate = date;
      cfg.schedulesJson = JSON.stringify(schedules);
      await this.repo.save(cfg);
    }
  }

  async updateMonthlyLastSent(triggerMonth: string, tenantId?: string): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    const monthly: MonthlySchedule = cfg.monthlyScheduleJson
      ? JSON.parse(cfg.monthlyScheduleJson)
      : { ...DEFAULT_MONTHLY };
    monthly.lastSentMonth = triggerMonth;
    cfg.monthlyScheduleJson = JSON.stringify(monthly);
    await this.repo.save(cfg);
  }

  async saveAll(
    emails: string[],
    schedules: ReportScheduleItem[],
    monthlySchedule?: MonthlySchedule,
    tenantId?: string,
  ): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    cfg.emailsJson = JSON.stringify(emails);
    cfg.schedulesJson = JSON.stringify(schedules);
    if (monthlySchedule !== undefined) {
      // Preserve lastSentMonth — never reset it from the frontend
      const existing: MonthlySchedule = cfg.monthlyScheduleJson
        ? JSON.parse(cfg.monthlyScheduleJson)
        : { ...DEFAULT_MONTHLY };
      cfg.monthlyScheduleJson = JSON.stringify({
        ...monthlySchedule,
        lastSentMonth: existing.lastSentMonth,
      });
    }
    await this.repo.save(cfg);
  }

  // Returns all configs (for scheduler that processes all tenants)
  async getAllConfigs(): Promise<ReportConfig[]> {
    return this.repo.find();
  }

  // ─── Dashboard schedule ───────────────────────────────────────────────────────

  private parseDashboardSchedule(cfg: ReportConfig): DashboardSchedule {
    try { return JSON.parse(cfg.dashboardScheduleJson); } catch { return { enabled: false, time: '08:00', emails: [], lastSentDate: null }; }
  }

  async getDashboardSchedule(tenantId?: string): Promise<DashboardSchedule> {
    const cfg = await this.getSingleton(tenantId);
    return this.parseDashboardSchedule(cfg);
  }

  async updateDashboardSchedule(schedule: Partial<DashboardSchedule>, tenantId?: string): Promise<DashboardSchedule> {
    const cfg = await this.getSingleton(tenantId);
    const existing = this.parseDashboardSchedule(cfg);
    const updated = { ...existing, ...schedule, lastSentDate: existing.lastSentDate };
    cfg.dashboardScheduleJson = JSON.stringify(updated);
    await this.repo.save(cfg);
    return updated;
  }

  async updateDashboardLastSent(date: string, tenantId?: string): Promise<void> {
    const cfg = await this.getSingleton(tenantId);
    const schedule = this.parseDashboardSchedule(cfg);
    schedule.lastSentDate = date;
    cfg.dashboardScheduleJson = JSON.stringify(schedule);
    await this.repo.save(cfg);
  }

  // ─── Anomaly schedule ─────────────────────────────────────────────────────────

  private readonly DEFAULT_ANOMALY: AnomalySchedule = {
    missingCheckInEnabled: false,
    shiftAlertEnabled: false,
    dayShiftLastAlertDate: null,
    nightShiftLastAlertDate: null,
  };

  parseAnomalySchedule(cfg: ReportConfig): AnomalySchedule {
    try { return { ...this.DEFAULT_ANOMALY, ...JSON.parse(cfg.anomalyScheduleJson) }; }
    catch { return { ...this.DEFAULT_ANOMALY }; }
  }

  async getAnomalySchedule(tenantId?: string): Promise<AnomalySchedule> {
    const cfg = await this.getSingleton(tenantId);
    return this.parseAnomalySchedule(cfg);
  }

  async updateAnomalySchedule(patch: Partial<AnomalySchedule>, tenantId?: string): Promise<AnomalySchedule> {
    const cfg = await this.getSingleton(tenantId);
    const existing = this.parseAnomalySchedule(cfg);
    const updated = { ...existing, ...patch };
    cfg.anomalyScheduleJson = JSON.stringify(updated);
    await this.repo.save(cfg);
    return updated;
  }
}
