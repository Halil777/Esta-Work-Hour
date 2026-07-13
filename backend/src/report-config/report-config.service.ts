import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportConfig, ReportScheduleItem, MonthlySchedule } from './report-config.entity';

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

  private async getSingleton(): Promise<ReportConfig> {
    let config = await this.repo.findOneBy({ id: 1 });
    if (!config) {
      config = this.repo.create({ id: 1, emailsJson: '[]', schedulesJson: '[]' });
      await this.repo.save(config);
    }
    return config;
  }

  async getConfig(): Promise<{
    emails: string[];
    schedules: ReportScheduleItem[];
    monthlySchedule: MonthlySchedule;
  }> {
    const cfg = await this.getSingleton();
    return {
      emails: JSON.parse(cfg.emailsJson),
      schedules: JSON.parse(cfg.schedulesJson),
      monthlySchedule: cfg.monthlyScheduleJson
        ? JSON.parse(cfg.monthlyScheduleJson)
        : DEFAULT_MONTHLY,
    };
  }

  async updateEmails(emails: string[]): Promise<void> {
    const cfg = await this.getSingleton();
    cfg.emailsJson = JSON.stringify(emails);
    await this.repo.save(cfg);
  }

  async updateSchedules(schedules: ReportScheduleItem[]): Promise<void> {
    const cfg = await this.getSingleton();
    cfg.schedulesJson = JSON.stringify(schedules);
    await this.repo.save(cfg);
  }

  async updateScheduleLastSent(scheduleId: string, date: string): Promise<void> {
    const cfg = await this.getSingleton();
    const schedules: ReportScheduleItem[] = JSON.parse(cfg.schedulesJson);
    const idx = schedules.findIndex(s => s.id === scheduleId);
    if (idx !== -1) {
      schedules[idx].lastSentDate = date;
      cfg.schedulesJson = JSON.stringify(schedules);
      await this.repo.save(cfg);
    }
  }

  async updateMonthlyLastSent(triggerMonth: string): Promise<void> {
    const cfg = await this.getSingleton();
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
  ): Promise<void> {
    const cfg = await this.getSingleton();
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
}
