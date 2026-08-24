import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One row per NFC card change on a worker's record — a card assigned, a
// card cleared, or a card taken away because it was reassigned to someone
// else. Kept worker-centric (one row per affected worker, even when a
// single card-report resolution touches two workers at once) so it reads
// naturally as "this worker's card history" on WorkerDetailPage, while
// `source`/`note` still make cross-worker reassignments traceable.
@Entity('card_assignment_history')
@Index(['workerEntityId', 'createdAt'])
export class CardAssignmentHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, default: null })
  tenantId: string | null;

  @Column()
  workerEntityId: string;

  // Snapshotted at write time — stays readable even if the worker is later
  // renamed or terminated.
  @Column({ type: 'varchar', nullable: true, default: null })
  workerName: string | null;

  @Column({ type: 'varchar' })
  action: 'ASSIGNED' | 'CLEARED';

  @Column({ type: 'varchar', nullable: true, default: null })
  previousCardUid: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  newCardUid: string | null;

  // 'card-report' (resolved from the NFC scanner's mismatch flow) or
  // 'manual-edit' (admin edited the worker record directly).
  @Column({ type: 'varchar', default: 'manual-edit' })
  source: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  changedBy: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
