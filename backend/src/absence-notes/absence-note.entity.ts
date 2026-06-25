import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('absence_notes')
export class AbsenceNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  workerEntityId: string;

  @Column({ type: 'varchar' })
  workerName: string;

  @Column({ type: 'varchar' })
  workerId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  note: string;

  // 'foreman' | 'admin'
  @Column({ type: 'varchar', default: 'admin' })
  createdBy: string;

  @Column({ type: 'varchar', default: '' })
  createdByName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
