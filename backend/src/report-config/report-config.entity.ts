import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export type ReportType =
  | 'daily_all'
  | 'daily_staff'
  | 'daily_shift_day'
  | 'daily_shift_night'
  | 'daily_attended'
  | 'daily_absent';

export interface ReportScheduleItem {
  id: string;
  label: string;
  time: string;         // HH:MM in server local time (Asia/Ashgabat)
  enabled: boolean;
  reportType: ReportType;
  lastSentDate: string | null; // YYYY-MM-DD, set after sending
}

@Entity('report_config')
export class ReportConfig {
  @PrimaryGeneratedColumn()
  id: number; // always 1 (singleton row)

  @Column({ type: 'text', default: '[]' })
  emailsJson: string; // JSON string[]

  @Column({ type: 'text', default: '[]' })
  schedulesJson: string; // JSON ReportScheduleItem[]

  @UpdateDateColumn()
  updatedAt: Date;
}
