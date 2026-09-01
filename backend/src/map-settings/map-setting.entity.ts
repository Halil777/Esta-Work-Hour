import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

// One row per tenant — holds the tenant admin's own Yandex Maps JS API key
// so the Operator Scan Locations map (Scanner Devices page) can render.
// Each tenant/company registers its own free key at
// https://developer.tech.yandex.ru/ — this is deliberately per-tenant
// (not a single shared key on the Tenant entity, which only the
// super-admin panel can edit) so every tenant admin can self-serve it.
@Entity('map_settings')
export class MapSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenantId: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  yandexMapsApiKey: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
