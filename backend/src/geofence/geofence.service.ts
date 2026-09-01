import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GeofenceZone } from './geofence-zone.entity';

export type GeofenceZoneInput = {
  label: string;
  scannerDeviceId: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(GeofenceZone)
    private readonly repo: Repository<GeofenceZone>,
  ) {}

  // All zones for the tenant, both global and device-specific — the admin
  // UI groups/labels them itself.
  findAll(tenantId: string): Promise<GeofenceZone[]> {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  create(tenantId: string, input: GeofenceZoneInput): Promise<GeofenceZone> {
    const zone = this.repo.create({ tenantId, ...input });
    return this.repo.save(zone);
  }

  async update(tenantId: string, id: string, input: Partial<GeofenceZoneInput>): Promise<GeofenceZone> {
    const zone = await this.repo.findOne({ where: { id, tenantId } });
    if (!zone) throw new NotFoundException('Zolak tapylmady');
    Object.assign(zone, input);
    return this.repo.save(zone);
  }

  async remove(tenantId: string, id: string): Promise<{ success: boolean }> {
    const result = await this.repo.delete({ id, tenantId });
    return { success: (result.affected ?? 0) > 0 };
  }

  /**
   * The zone set that actually governs a given device's scans: if that
   * device has any zones of its own, those are used exclusively (a
   * device-specific set fully replaces the global one, it never merges
   * with it); otherwise the tenant's global zones (scannerDeviceId = null)
   * apply. An empty result means "no restriction configured" — callers
   * must treat that as unlimited, not as zero allowed area.
   */
  async getEffectiveZones(tenantId: string, scannerDeviceId: string | null): Promise<GeofenceZone[]> {
    if (!scannerDeviceId) {
      return this.repo.find({ where: { tenantId, scannerDeviceId: IsNull() } });
    }
    const deviceZones = await this.repo.find({ where: { tenantId, scannerDeviceId } });
    if (deviceZones.length > 0) return deviceZones;
    return this.repo.find({ where: { tenantId, scannerDeviceId: IsNull() } });
  }
}
