import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RegistrationDto } from './registration.dto.js';
import type { SwimmingGroup } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MoveDto } from './move.dto.js';
import { MailService } from '../mail/mail.service.js';
import { registrationReceipt } from './registration-receipt.js';
import { StatusLinkService } from './status-link.service.js';
import { statusLinkDeliveryDetails } from './status-link-delivery.js';

const publicFields = {
  id: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  email: true,
  badges: true,
  swimmingStyles: true,
  message: true,
  registeredAt: true,
  status: true,
  group: true,
  queueOrder: true,
} as const;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(StatusLinkService) private readonly statusLinks: StatusLinkService,
  ) {}

  async details(id: string) {
    const details = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      select: {
        internalNotes: true,
        id: true,
        registeredAt: true,
        group: true,
        status: true,
        statusLinkDelivery: true,
        statusLinkAttemptAt: true,
        statusLinkSentAt: true,
        groupChanges: true,
        orderChanges: {
          select: {
            id: true,
            group: true,
            previousPosition: true,
            newPosition: true,
            reason: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!details) throw new NotFoundException('Waitlist entry not found');
    const history = [
      {
        id: `registration-${details.id}`,
        type: 'REGISTERED',
        createdAt: details.registeredAt,
        previousGroup: null,
        group: null,
        previousPosition: null,
        newPosition: null,
        reason: null,
      },
      ...details.groupChanges.map((change) => ({
        id: change.id,
        type: change.previousGroup ? 'GROUP_CHANGED' : 'GROUP_ASSIGNED',
        createdAt: change.createdAt,
        previousGroup: change.previousGroup,
        group: change.newGroup,
        previousPosition: null,
        newPosition: null,
        reason: null,
      })),
      ...details.orderChanges.map((change) => ({
        id: change.id,
        type: 'POSITION_CHANGED',
        createdAt: change.createdAt,
        previousGroup: null,
        group: change.group,
        previousPosition: change.previousPosition,
        newPosition: change.newPosition,
        reason: change.reason,
      })),
      ...(details.statusLinkSentAt
        ? [
            {
              id: `status-link-${details.id}`,
              type: 'STATUS_LINK_SENT',
              createdAt: details.statusLinkSentAt,
              previousGroup: null,
              group: null,
              previousPosition: null,
              newPosition: null,
              reason: null,
            },
          ]
        : []),
    ].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
    );
    return {
      internalNotes: details.internalNotes,
      history,
      statusLinkDelivery: statusLinkDeliveryDetails(details),
      groupHistoryIncomplete:
        details.group !== null &&
        !details.groupChanges.some((change) => change.previousGroup === null),
    };
  }

  async updateNotes(id: string, internalNotes: string): Promise<{ status: 'saved' }> {
    const result = await this.prisma.waitlistEntry.updateMany({
      where: { id },
      data: { internalNotes: internalNotes || null },
    });
    if (result.count === 0) throw new NotFoundException('Waitlist entry not found');
    return { status: 'saved' };
  }

  async move(id: string, move: MoveDto): Promise<{ status: 'moved' }> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(74102, 1)`;
        const entry = await tx.waitlistEntry.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Waitlist entry not found');
        if (entry.status !== 'WAITING' || entry.group !== move.group) {
          throw new ConflictException('Waitlist entry is no longer waiting in the expected group');
        }
        const queue = await tx.waitlistEntry.findMany({
          where: { group: move.group, status: 'WAITING' },
          orderBy: { queueOrder: 'asc' },
        });
        const previousIndex = queue.findIndex((other) => other.id === id);
        if (previousIndex + 1 !== move.previousPosition)
          throw new ConflictException('Waiting position has changed; reload before moving');
        if (move.position > queue.length || move.position === move.previousPosition) {
          throw new BadRequestException(
            'Target position must be within the queue and differ from the current position',
          );
        }
        const ids = queue.map((other) => other.id);
        ids.splice(previousIndex, 1);
        ids.splice(move.position - 1, 0, id);
        await this.resequence(tx, move.group, ids);
        await tx.waitlistOrderChange.create({
          data: {
            entryId: id,
            group: move.group,
            previousPosition: previousIndex + 1,
            newPosition: move.position,
            reason: move.reason,
          },
        });
      },
      { timeout: 15000 },
    );
    return { status: 'moved' };
  }

  async list() {
    const entries = await this.prisma.waitlistEntry.findMany({
      select: publicFields,
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    });
    const positions = new Map<string, number>();
    for (const group of ['GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4'] as const) {
      entries
        .filter((entry) => entry.group === group && entry.status === 'WAITING')
        .sort((left, right) => (left.queueOrder ?? 0) - (right.queueOrder ?? 0))
        .forEach((entry, index) => positions.set(entry.id, index + 1));
    }
    return entries.map(({ queueOrder: _queueOrder, birthDate, ...entry }) => ({
      ...entry,
      birthDate: birthDate.toISOString().slice(0, 10),
      position: positions.get(entry.id) ?? null,
    }));
  }

  async assign(id: string, group: SwimmingGroup): Promise<{ status: 'assigned' }> {
    const initialAssignment = await this.prisma.$transaction(
      async (tx) => {
        // All queue-changing operations must take this transaction-scoped lock first.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(74102, 1)`;
        const entry = await tx.waitlistEntry.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Waitlist entry not found');
        if (entry.status !== 'UNASSIGNED' && entry.status !== 'WAITING') {
          throw new ConflictException('Only unassigned or waiting entries can be assigned');
        }
        if (entry.group === group) return;
        const previousGroup = entry.group;
        await tx.waitlistEntry.update({
          where: { id },
          data: { status: 'UNASSIGNED', group: null, queueOrder: null },
        });
        if (previousGroup) await this.resequence(tx, previousGroup);
        const queue = await tx.waitlistEntry.findMany({
          where: { group, status: 'WAITING' },
          orderBy: { queueOrder: 'asc' },
        });
        const index = queue.findIndex(
          (other) =>
            other.registeredAt > entry.registeredAt ||
            (other.registeredAt.getTime() === entry.registeredAt.getTime() && other.id > entry.id),
        );
        queue.splice(index < 0 ? queue.length : index, 0, entry);
        await this.resequence(
          tx,
          group,
          queue.map((other) => other.id),
        );
        await tx.waitlistGroupChange.create({
          data: { entryId: id, previousGroup, newGroup: group },
        });
        if (!previousGroup && entry.statusLinkDelivery === 'NONE') {
          await tx.waitlistEntry.update({ where: { id }, data: { statusLinkDelivery: 'PENDING' } });
          return true;
        }
        return false;
      },
      { timeout: 15000 },
    );
    if (initialAssignment) await this.statusLinks.sendAutomatic(id);
    return { status: 'assigned' };
  }

  private async resequence(
    tx: Prisma.TransactionClient,
    group: SwimmingGroup,
    ids?: string[],
  ): Promise<void> {
    const queue = await tx.waitlistEntry.findMany({
      where: { group, status: 'WAITING' },
      orderBy: { queueOrder: 'asc' },
    });
    const orderedIds = ids ?? queue.map((entry) => entry.id);
    const maximum = Math.max(0, ...queue.map((entry) => entry.queueOrder ?? 0));
    // Move to unused positive keys first because the unique index is immediate.
    for (const [index, entryId] of orderedIds.entries()) {
      await tx.waitlistEntry.update({
        where: { id: entryId },
        data: { group, status: 'WAITING', queueOrder: maximum + index + 1 },
      });
    }
    for (const [index, entryId] of orderedIds.entries()) {
      await tx.waitlistEntry.update({ where: { id: entryId }, data: { queueOrder: index + 1 } });
    }
  }

  async register(registration: RegistrationDto): Promise<{ status: 'received' }> {
    const entry = await this.prisma.waitlistEntry.create({
      data: {
        firstName: registration.firstName,
        lastName: registration.lastName,
        birthDate: new Date(`${registration.birthDate}T00:00:00.000Z`),
        email: registration.email,
        badges: registration.badges,
        swimmingStyles: registration.swimmingStyles,
        message: registration.message || null,
      },
      select: { id: true },
    });
    try {
      await this.mail.send(registrationReceipt(registration));
    } catch {
      this.logger.warn(
        `Registration receipt could not be sent for waitlist entry ${entry.id}. Registration remains saved.`,
      );
    }
    return { status: 'received' };
  }
}
