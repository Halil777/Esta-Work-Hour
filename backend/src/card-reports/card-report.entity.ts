import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type CardReportStatus = 'pending' | 'resolved' | 'dismissed';

@Entity('card_reports')
export class CardReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column()
  cardUid: string;

  @Column({ nullable: true })
  currentWorkerName: string;

  @Column({ nullable: true })
  suggestedWorkerId: string;

  @Column({ nullable: true })
  suggestedWorkerName: string;

  @Column({ nullable: true })
  deviceLabel: string;

  @Column({ nullable: true })
  note: string;

  @Column({ default: 'pending' })
  status: CardReportStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string;
}
