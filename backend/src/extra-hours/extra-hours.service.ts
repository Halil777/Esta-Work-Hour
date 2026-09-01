import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ExtraHoursRequest, ExtraRequestStatus } from './extra-hours-request.entity';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';
import { ExtraHoursRequestRecipient, RecipientAction } from './extra-hours-request-recipient.entity';
import { Worker, MobileRole } from '../workers/worker.entity';

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

const REQUEST_RELATIONS = ['items', 'recipients'];

@Injectable()
export class ExtraHoursService {
  constructor(
    @InjectRepository(ExtraHoursRequest)
    private readonly requestRepo: Repository<ExtraHoursRequest>,
    @InjectRepository(ExtraHoursRequestItem)
    private readonly itemRepo: Repository<ExtraHoursRequestItem>,
    @InjectRepository(ExtraHoursRequestRecipient)
    private readonly recipientRepo: Repository<ExtraHoursRequestRecipient>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  // FOREMAN: create extra hours request — sent to one, several, or every
  // site chief at once. Each gets their own independently-tracked
  // recipient row; see takeAction() for how their responses roll up.
  async createRequest(
    foremanWorkerEntityId: string,
    siteChiefWorkerEntityIds: string[],
    workDate: string,
    note: string | null,
    items: { workerEntityId: string; extraHours: number; description?: string }[],
  ) {
    const foreman = await this.workerRepo.findOneBy({ id: foremanWorkerEntityId });
    if (!foreman) throw new NotFoundException('Forman tapylmady');

    if (!Array.isArray(siteChiefWorkerEntityIds) || siteChiefWorkerEntityIds.length === 0) {
      throw new BadRequestException('Iň azyndan bir ýolbaşçy saýlaň');
    }
    const uniqueSiteChiefIds = [...new Set(siteChiefWorkerEntityIds)];
    const siteChiefs = await this.workerRepo.find({
      where: {
        id: In(uniqueSiteChiefIds),
        tenantId: foreman.tenantId === null ? IsNull() : foreman.tenantId,
        mobileRole: MobileRole.SiteChief,
      },
    });
    if (siteChiefs.length !== uniqueSiteChiefIds.length) {
      throw new NotFoundException('Saýlanan ýolbaşçylaryň käbiri tapylmady');
    }

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
      workDate,
      note,
      status: ExtraRequestStatus.Pending,
      seenAt: null,
      actionAt: null,
      tenantId: foreman.tenantId,
      items: requestItems as ExtraHoursRequestItem[],
      recipients: siteChiefs.map(sc => ({
        siteChiefWorkerEntityId: sc.id,
        siteChiefName: sc.name,
        seenAt: null,
        action: RecipientAction.Pending,
        actionAt: null,
      })) as ExtraHoursRequestRecipient[],
    });

    const saved = await this.requestRepo.save(req);

    for (const sc of siteChiefs) {
      if (sc.pushToken) {
        sendExpoPush(sc.pushToken, 'Täze goşmaça sag sorogy', `${foreman.name}: ${items.length} işçi, ${workDate}`);
      }
    }

    return this.requestRepo.findOne({ where: { id: saved.id }, relations: REQUEST_RELATIONS });
  }

  // FOREMAN: get my sent requests (with every recipient's status, so the
  // foreman can see who's seen/approved/rejected it).
  async getFormanRequests(foremanWorkerEntityId: string) {
    return this.requestRepo.find({
      where: { foremanWorkerEntityId },
      relations: REQUEST_RELATIONS,
      order: { sentAt: 'DESC' },
    });
  }

  // SITE CHIEF: get incoming requests — every request where this site
  // chief is (one of) the recipients, each still showing every other
  // recipient too so they can see who else it went to.
  async getSiteChiefRequests(siteChiefWorkerEntityId: string) {
    const rows = await this.recipientRepo.find({
      where: { siteChiefWorkerEntityId },
      select: ['requestId'],
    });
    const requestIds = [...new Set(rows.map(r => r.requestId))];
    if (requestIds.length === 0) return [];
    return this.requestRepo.find({
      where: { id: In(requestIds) },
      relations: REQUEST_RELATIONS,
      order: { sentAt: 'DESC' },
    });
  }

  // SITE CHIEF: mark as seen (idempotent — safe to call every time the
  // detail view opens, regardless of whether this recipient, or the
  // request overall, has already been acted on).
  async markSeen(requestId: string, siteChiefWorkerEntityId: string) {
    const recipient = await this.recipientRepo.findOneBy({ requestId, siteChiefWorkerEntityId });
    if (!recipient) throw new ForbiddenException('Bu request size degişli däl');

    if (!recipient.seenAt) {
      recipient.seenAt = new Date();
      await this.recipientRepo.save(recipient);

      const req = await this.requestRepo.findOneBy({ id: requestId });
      if (req && !req.seenAt) {
        req.seenAt = recipient.seenAt;
        await this.requestRepo.save(req);
      }
    }
    return this.requestRepo.findOne({ where: { id: requestId }, relations: REQUEST_RELATIONS });
  }

  // SITE CHIEF: approve or reject. Roll-up rule: the FIRST recipient to
  // approve settles the request as approved for everyone (worker extraSaat
  // is credited exactly once, right here); a rejection only finalizes the
  // request once EVERY recipient has rejected it — until then it stays
  // open for the others to still approve. Locks the request row for the
  // duration so two site chiefs approving at the same instant can't both
  // trigger the pay credit.
  async takeAction(requestId: string, siteChiefWorkerEntityId: string, action: 'approved' | 'rejected') {
    return this.requestRepo.manager.transaction(async manager => {
      const req = await manager.findOne(ExtraHoursRequest, {
        where: { id: requestId },
        relations: REQUEST_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!req) throw new NotFoundException('Request tapylmady');

      const recipient = req.recipients.find(r => r.siteChiefWorkerEntityId === siteChiefWorkerEntityId);
      if (!recipient) throw new ForbiddenException('Bu request size degişli däl');

      if (req.status === ExtraRequestStatus.Approved) {
        throw new ConflictException('Bu sorog eýýäm başga ýolbaşçy tarapyndan tassyklandy');
      }
      if (req.status === ExtraRequestStatus.Rejected) {
        throw new ConflictException('Bu sorog eýýäm ret edildi');
      }

      const now = new Date();
      recipient.action = action === 'approved' ? RecipientAction.Approved : RecipientAction.Rejected;
      recipient.actionAt = now;
      if (!recipient.seenAt) recipient.seenAt = now;
      await manager.save(recipient);

      const anyApproved = req.recipients.some(r => r.action === RecipientAction.Approved);
      const allRejected = req.recipients.every(r => r.action === RecipientAction.Rejected);

      if (anyApproved) {
        req.status = ExtraRequestStatus.Approved;
        req.actionAt = now;
        await manager.save(req);
        for (const item of req.items) {
          const worker = await manager.findOneBy(Worker, { id: item.workerEntityId });
          if (worker) {
            worker.extraSaat = Number(worker.extraSaat) + Number(item.extraHours);
            await manager.save(worker);
          }
        }
      } else if (allRejected) {
        req.status = ExtraRequestStatus.Rejected;
        req.actionAt = now;
        await manager.save(req);
      }

      if (anyApproved || allRejected) {
        const foreman = await manager.findOneBy(Worker, { id: req.foremanWorkerEntityId });
        if (foreman?.pushToken) {
          const msg = anyApproved ? 'Tassyklandy ✅' : 'Ret edildi ❌';
          sendExpoPush(foreman.pushToken, 'Goşmaça sag sorogy', `${req.workDate} üçin sorog ${msg}`);
        }
      }

      return req;
    });
  }

  // ADMIN: approve or reject any request directly — bypasses the
  // recipient roll-up (an admin override), but stays idempotent so it
  // can never double-credit extraSaat if the request was already
  // finalized (by a site chief or an earlier admin action).
  async adminAction(requestId: string, action: 'approved' | 'rejected', tenantId?: string) {
    return this.requestRepo.manager.transaction(async manager => {
      const req = await manager.findOne(ExtraHoursRequest, {
        where: { id: requestId, ...(tenantId ? { tenantId } : {}) },
        relations: REQUEST_RELATIONS,
        lock: { mode: 'pessimistic_write' },
      });
      if (!req) throw new NotFoundException('Request tapylmady');
      if (req.status === ExtraRequestStatus.Approved || req.status === ExtraRequestStatus.Rejected) {
        return req; // already finalized — no-op instead of re-applying pay
      }

      const now = new Date();
      req.status = action === 'approved' ? ExtraRequestStatus.Approved : ExtraRequestStatus.Rejected;
      req.actionAt = now;
      await manager.save(req);

      if (action === 'approved') {
        for (const item of req.items) {
          const worker = await manager.findOneBy(Worker, { id: item.workerEntityId });
          if (worker) {
            worker.extraSaat = Number(worker.extraSaat) + Number(item.extraHours);
            await manager.save(worker);
          }
        }
      }

      const foreman = await manager.findOneBy(Worker, { id: req.foremanWorkerEntityId });
      if (foreman?.pushToken) {
        const msg = action === 'approved' ? 'Tassyklandy ✅' : 'Ret edildi ❌';
        sendExpoPush(foreman.pushToken, 'Goşmaça sag sorogy (Admin)', `${req.workDate} üçin sorog ${msg}`);
      }

      return req;
    });
  }

  // ADMIN: get all requests with full status
  async getAllRequests(params: {
    status?: string;
    foremanWorkerEntityId?: string;
    siteChiefWorkerEntityId?: string;
    limit?: number;
    tenantId?: string;
  } = {}) {
    // Resolved separately (rather than as a WHERE on the joined recipient
    // alias below) so filtering by one recipient doesn't drop every OTHER
    // recipient of the same matched requests out of the eager-loaded list.
    let candidateIds: string[] | null = null;
    if (params.siteChiefWorkerEntityId) {
      const rows = await this.recipientRepo.find({
        where: { siteChiefWorkerEntityId: params.siteChiefWorkerEntityId },
        select: ['requestId'],
      });
      candidateIds = [...new Set(rows.map(r => r.requestId))];
      if (candidateIds.length === 0) return [];
    }

    const query = this.requestRepo.createQueryBuilder('req')
      .leftJoinAndSelect('req.items', 'item')
      .leftJoinAndSelect('req.recipients', 'recipient');

    if (params.status && params.status !== 'all') {
      query.andWhere('req.status = :status', { status: params.status });
    }
    if (params.foremanWorkerEntityId) {
      query.andWhere('req.foremanWorkerEntityId = :fid', { fid: params.foremanWorkerEntityId });
    }
    if (candidateIds) {
      query.andWhere('req.id IN (:...ids)', { ids: candidateIds });
    }
    if (params.tenantId) {
      query.andWhere('req.tenantId = :tid', { tid: params.tenantId });
    }

    query.orderBy('req.sentAt', 'DESC');
    if (params.limit) query.take(params.limit);

    return query.getMany();
  }
}
