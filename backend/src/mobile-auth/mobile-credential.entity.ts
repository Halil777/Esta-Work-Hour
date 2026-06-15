import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('mobile_credentials')
export class MobileCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  workerEntityId: string; // references Worker.id (uuid)

  @Column({ type: 'varchar' })
  role: string; // 'foreman' | 'site_chief'

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
