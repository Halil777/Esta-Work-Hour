import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

export interface ReportScheduleItem {
  id: string;
  label: string;
  time: string;       // HH:MM in server local time (Asia/Ashgabat)
  enabled: boolean;
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
