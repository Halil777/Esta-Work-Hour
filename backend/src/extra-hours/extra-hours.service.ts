import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtraHoursRequest, ExtraRequestStatus } from './extra-hours-request.entity';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';
import { Worker } from '../workers/worker.entity';

async function sendExpoPush(to: string, title: string, body: string): Promise<void> {
  if (!to || !to.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to, title, body, sound: 'default', priority: 'high' }),
    });
  } catch {}
}

@Injectable()
export class ExtraHoursService {
  constructor(
    @InjectRepository(ExtraHoursRequest)
    private readonly requestRepo: Repository<ExtraHoursRequest>,
    @InjectRepository(ExtraHoursRequestItem)
    private readonly itemRepo: Repository<ExtraHoursRequestItem>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  // FOREMAN: create extra hours request
  async createRequest(
    foremanWorkerEntityId: string,
    siteChiefWorkerEntityId: string,
    workDate: string,
    note: string | null,
    items: { workerEntityId: string; extraHours: number; description?: string }[],
  ) {
    const foreman = await this.workerRepo.findOneBy({ id: foremanWorkerEntityId });
    if (!foreman) throw new NotFoundException('Forman tapylmady');

    const siteChief = await this.workerRepo.findOneBy({ id: siteChiefWorkerEntityId });
    if (!siteChief) throw new NotFoundException('Site chief tapylmady');

    const requestItems: Partial<ExtraHoursRequestItem>[] = [];
    for (const item of items) {
      const worker = await this.workerRepo.findOneBy({ id: item.workerEntityId });
      if (!worker) continue;
      requestItems.push({
        workerEntityId: item.workerEntityId,
        workerName: worker.name,
        workerId: worker.workerId,
        extraHours: item.extraHours,
        description: item.description ?? null,
      });
    }

    const req = this.requestRepo.create({
      foremanWorkerEntityId,
      foremanName: foreman.name,
      siteChiefWorkerEntityId,
      siteChiefName: siteChief.name,
      workDate,
      note,
      status: ExtraRequestStatus.Pending,
      seenAt: null,
      actionAt: null,
      items: requestItems as ExtraHoursRequestItem[],
    });

    const saved = await this.requestRepo.save(req);

    // Notify site chief about new request
    if (siteChief.pushToken) {
      sendExpoPush(siteChief.pushToken, 'Täze goşmaça sag sorogy', `${foreman.name}: ${items.length} işçi, ${workDate}`);
    }

    return saved;
  }

  // FOREMAN: get my sent requests
  async getFormanRequests(foremanWorkerEntityId: string) {
    return this.requestRepo.find({
      where: { foremanWorkerEntityId },
      order: { sentAt: 'DESC' },
    });
  }

  // SITE CHIEF: get incoming requests
  async getSiteChiefRequests(siteChiefWorkerEntityId: string) {
    return this.requestRepo.find({
      where: { siteChiefWorkerEntityId },
      order: { sentAt: 'DESC' },
    });
  }

  // SITE CHIEF: mark as seen
  async markSeen(requestId: string, siteChiefWorkerEntityId: string) {
    const req = await this.requestRepo.findOneBy({ id: requestId });
    if (!req) throw new NotFoundException('Request tapylmady');
    if (req.siteChiefWorkerEntityId !== siteChiefWorkerEntityId) {
      throw new ForbiddenException('Bu request size degişli däl');
    }
    if (req.status === ExtraRequestStatus.Pending) {
      req.status = ExtraRequestStatus.Seen;
      req.seenAt = new Date();
      await this.requestRepo.save(req);
    }
    return req;
  }

  // SITE CHIEF: approve or reject
  async takeAction(
    requestId: string,
    siteChiefWorkerEntityId: string,
    action: 'approved' | 'rejected',
  ) {
    const req = await this.requestRepo.findOneBy({ id: requestId });
    if (!req) throw new NotFoundException('Request tapylmady');
    if (req.siteChiefWorkerEntityId !== siteChiefWorkerEntityId) {
      throw new ForbiddenException('Bu request size degişli däl');
    }

    req.status = action === 'approved' ? ExtraRequestStatus.Approved : ExtraRequestStatus.Rejected;
    req.actionAt = new Date();
    if (!req.seenAt) req.seenAt = new Date();

    await this.requestRepo.save(req);

    // If approved — add extraSaat to each worker
    if (action === 'approved') {
      for (const item of req.items) {
        const worker = await this.workerRepo.findOneBy({ id: item.workerEntityId });
        if (worker) {
          worker.extraSaat = Number(worker.extraSaat) + Number(item.extraHours);
          await this.workerRepo.save(worker);
        }
      }
    }

    // Notify foreman about action result
    const foreman = await this.workerRepo.findOneBy({ id: req.foremanWorkerEntityId });
    if (foreman?.pushToken) {
      const msg = action === 'approved' ? 'Tassyklandy ✅' : 'Ret edildi ❌';
      sendExpoPush(foreman.pushToken, 'Goşmaça sag sorogy', `${req.workDate} üçin sorog ${msg}`);
    }

    return req;
  }

  // ADMIN: approve or reject any request
  async adminAction(requestId: string, action: 'approved' | 'rejected') {
    const req = await this.requestRepo.findOneBy({ id: requestId });
    if (!req) throw new NotFoundException('Request tapylmady');

    req.status = action === 'approved' ? ExtraRequestStatus.Approved : ExtraRequestStatus.Rejected;
    req.actionAt = new Date();
    if (!req.seenAt) req.seenAt = new Date();

    await this.requestRepo.save(req);

    if (action === 'approved') {
      for (const item of req.items) {
        const worker = await this.workerRepo.findOneBy({ id: item.workerEntityId });
        if (worker) {
          worker.extraSaat = Number(worker.extraSaat) + Number(item.extraHours);
          await this.workerRepo.save(worker);
        }
      }
    }

    // Notify foreman
    const foreman = await this.workerRepo.findOneBy({ id: req.foremanWorkerEntityId });
    if (foreman?.pushToken) {
      const msg = action === 'approved' ? 'Tassyklandy ✅' : 'Ret edildi ❌';
      sendExpoPush(foreman.pushToken, 'Goşmaça sag sorogy (Admin)', `${req.workDate} üçin sorog ${msg}`);
    }

    return req;
  }

  // ADMIN: get all requests with full status
  async getAllRequests(params: {
    status?: string;
    foremanWorkerEntityId?: string;
    siteChiefWorkerEntityId?: string;
    limit?: number;
  } = {}) {
    const query = this.requestRepo.createQueryBuilder('req').leftJoinAndSelect('req.items', 'item');

    if (params.status && params.status !== 'all') {
      query.andWhere('req.status = :status', { status: params.status });
    }
    if (params.foremanWorkerEntityId) {
      query.andWhere('req.foremanWorkerEntityId = :fid', { fid: params.foremanWorkerEntityId });
    }
    if (params.siteChiefWorkerEntityId) {
      query.andWhere('req.siteChiefWorkerEntityId = :sid', { sid: params.siteChiefWorkerEntityId });
    }

    query.orderBy('req.sentAt', 'DESC');
    if (params.limit) query.take(params.limit);

    return query.getMany();
  }
}
