import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { ExtraHoursRequest } from './extra-hours-request.entity';

export enum RecipientAction {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

// One row per site chief a request was sent to. A request can go to several
// (or all) site chiefs at once; each tracks its own seen/action
// independently — see ExtraHoursService.takeAction for how these roll up
// into the request's overall status ("any one approval settles it for
// everyone" — a rejection only finalizes the request once every recipient
// has rejected).
@Index(['requestId'])
@Index(['siteChiefWorkerEntityId'])
@Entity('extra_hours_request_recipients')
export class ExtraHoursRequestRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExtraHoursRequest, req => req.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ExtraHoursRequest;

  @Column({ type: 'varchar' })
  requestId: string;

  @Column({ type: 'varchar' })
  siteChiefWorkerEntityId: string; // Worker.id of site chief

  @Column({ type: 'varchar' })
  siteChiefName: string;

  @Column({ type: 'timestamp', nullable: true })
  seenAt: Date | null;

  @Column({
    type: 'enum',
    enum: RecipientAction,
    default: RecipientAction.Pending,
  })
  action: RecipientAction;

  @Column({ type: 'timestamp', nullable: true })
  actionAt: Date | null;
}
