import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapSetting } from './map-setting.entity';

@Injectable()
export class MapSettingsService {
  constructor(
    @InjectRepository(MapSetting)
    private readonly repo: Repository<MapSetting>,
  ) {}

  async get(tenantId: string): Promise<{ yandexMapsApiKey: string | null }> {
    const setting = await this.repo.findOne({ where: { tenantId } });
    return { yandexMapsApiKey: setting?.yandexMapsApiKey ?? null };
  }

  async update(tenantId: string, yandexMapsApiKey: string | null): Promise<{ yandexMapsApiKey: string | null }> {
    let setting = await this.repo.findOne({ where: { tenantId } });
    if (!setting) setting = this.repo.create({ tenantId });
    setting.yandexMapsApiKey = yandexMapsApiKey?.trim() || null;
    const saved = await this.repo.save(setting);
    return { yandexMapsApiKey: saved.yandexMapsApiKey };
  }
}
