import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export type ReportType =
  | 'daily_all'
  | 'daily_staff'
  | 'daily_workers'
  | 'daily_shift_day'
  | 'daily_shift_night'
  | 'daily_attended'
  | 'daily_absent';

export interface ReportScheduleItem {
  id: string;
  label: string;
  time: string;         // HH:MM in server local time (Europe/Moscow = UTC+3, Tatarstan)
  enabled: boolean;
  reportType: ReportType;
  lastSentDate: string | null; // YYYY-MM-DD, set after sending
}

export interface MonthlySchedule {
  enabled: boolean;
  time: string;              // HH:MM — fires on 1st day of each month
  emails: string[];          // separate recipients for monthly report
  lastSentMonth: string | null; // YYYY-MM of the month when send was triggered
}

export interface DashboardSchedule {
  enabled: boolean;
  time: string;        // HH:MM — fires daily
  emails: string[];
  lastSentDate: string | null; // YYYY-MM-DD
}

export interface AnomalySchedule {
  missingCheckInEnabled: boolean;   // daily 9 AM email for checkout-without-checkin
  shiftAlertEnabled: boolean;        // email after grace period for missing shift check-in
  checkOutAlertEnabled: boolean;     // email after shift end for missing check-out
  dayShiftLastAlertDate: string | null;   // YYYY-MM-DD last sent
  nightShiftLastAlertDate: string | null; // YYYY-MM-DD last sent
  checkOutDayLastAlertDate: string | null;
  checkOutNightLastAlertDate: string | null;
}

@Entity('report_config')
export class ReportConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null; // null = global (legacy singleton), uuid = per-tenant

  @Column({ type: 'text', default: '[]' })
  emailsJson: string; // JSON string[]

  @Column({ type: 'text', default: '[]' })
  schedulesJson: string; // JSON ReportScheduleItem[]

  @Column({
    type: 'text',
    default: '{"enabled":false,"time":"08:00","emails":[],"lastSentMonth":null}',
  })
  monthlyScheduleJson: string; // JSON MonthlySchedule

  @Column({
    type: 'text',
    default: '{"enabled":false,"time":"08:00","emails":[],"lastSentDate":null}',
  })
  dashboardScheduleJson: string; // JSON DashboardSchedule

  @Column({
    type: 'text',
    default: '{"missingCheckInEnabled":false,"shiftAlertEnabled":false,"checkOutAlertEnabled":false,"dayShiftLastAlertDate":null,"nightShiftLastAlertDate":null,"checkOutDayLastAlertDate":null,"checkOutNightLastAlertDate":null}',
  })
  anomalyScheduleJson: string; // JSON AnomalySchedule

  @Column({ type: 'varchar', length: 5, default: 'tr' })
  lang: string; // report language: 'tr' | 'ru' | 'en'

  @UpdateDateColumn()
  updatedAt: Date;
}
