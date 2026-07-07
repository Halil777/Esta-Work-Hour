import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftSetting } from './shift-setting.entity';

const DEFAULTS = {
  day:   { startTime: '07:00', endTime: '19:00', graceMinutes: 60 },
  night: { startTime: '19:00', endTime: '07:00', graceMinutes: 60 },
};

@Injectable()
export class ShiftSettingsService {
  constructor(
    @InjectRepository(ShiftSetting)
    private readonly repo: Repository<ShiftSetting>,
  ) {}

  async getAll(): Promise<ShiftSetting[]> {
    const existing = await this.repo.find();
    const map = new Map(existing.map(s => [s.shiftType, s]));

    for (const type of ['day', 'night'] as const) {
      if (!map.has(type)) {
        const d = DEFAULTS[type];
        const s = await this.repo.save(
          this.repo.create({ shiftType: type, startTime: d.startTime, endTime: d.endTime, graceMinutes: d.graceMinutes }),
        );
        map.set(type, s);
      }
    }

    return [map.get('day')!, map.get('night')!];
  }

  async update(
    shiftType: 'day' | 'night',
    startTime: string,
    endTime: string,
    graceMinutes: number,
  ): Promise<ShiftSetting> {
    let setting = await this.repo.findOneBy({ shiftType });
    if (!setting) {
      setting = this.repo.create({ shiftType });
    }
    setting.startTime = startTime;
    setting.endTime = endTime;
    setting.graceMinutes = graceMinutes;
    return this.repo.save(setting);
  }
}
