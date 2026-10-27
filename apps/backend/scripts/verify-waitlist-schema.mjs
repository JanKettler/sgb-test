import assert from 'node:assert/strict';
import { PrismaService } from '../dist/database/prisma.service.js';
import { WaitlistService } from '../dist/waitlist/waitlist.service.js';
import { WaitlistStatusService } from '../dist/waitlist/waitlist-status.service.js';
import { hashStatusToken } from '../dist/waitlist/status-token.js';
import { StatusLinkService } from '../dist/waitlist/status-link.service.js';

const prisma = new PrismaService();
const rollback = new Error('Intentional verification rollback');
function createWaitlistService(database) {
  return new WaitlistService(
    database,
    { send: async () => 'disabled' },
    { sendAutomatic: async () => {} },
  );
}
const sample = {
  firstName: 'Example',
  lastName: 'Swimmer',
  birthDate: new Date('2016-01-02T00:00:00.000Z'),
  email: 'swimmer@example.invalid',
  badges: ['SEAHORSE'],
  swimmingStyles: ['BREASTSTROKE'],
};

async function verifyWithRollback(check) {
  try {
    await prisma.$transaction(async (tx) => {
      await check(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function expectConstraint(data, constraint) {
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.waitlistEntry.create({ data: { ...sample, ...data } });
      throw rollback;
    }),
    (error) => error !== rollback && String(error).includes(constraint),
  );
}

try {
  await prisma.$connect();
  const failedMoveIds = [crypto.randomUUID(), crypto.randomUUID()];
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const service = createWaitlistService({
        waitlistEntry: tx.waitlistEntry,
        $transaction: (operation) => operation(tx),
      });
      for (const [index, id] of failedMoveIds.entries()) {
        await tx.waitlistEntry.create({
          data: { ...sample, id, registeredAt: new Date(`2000-01-0${index + 1}T00:00:00Z`) },
        });
        await service.assign(id, 'GROUP_2');
      }
      const entries = await service.list();
      await service.move(failedMoveIds[1], {
        group: 'GROUP_2',
        previousPosition: entries.find((entry) => entry.id === failedMoveIds[1]).position,
        position: entries.find((entry) => entry.id === failedMoveIds[0]).position,
        reason: '', // Force history constraint failure after resequencing.
      });
    }),
    (error) => String(error).includes('WaitlistOrderChange_reason_check'),
  );
  assert.equal(await prisma.waitlistEntry.count({ where: { id: { in: failedMoveIds } } }), 0);
  await verifyWithRollback(async (tx) => {
    const service = createWaitlistService({
      waitlistEntry: tx.waitlistEntry,
      $transaction: (operation) => operation(tx),
    });
    const created = [];
    for (const date of ['2000-01-01', '2000-01-02', '2000-01-03']) {
      const entry = await tx.waitlistEntry.create({
        data: { ...sample, registeredAt: new Date(`${date}T00:00:00Z`) },
      });
      created.push(entry);
      await service.assign(entry.id, 'GROUP_4');
    }
    const ids = created.map((entry) => entry.id);
    const list = await service.list();
    const firstPosition = list.find((entry) => entry.id === ids[0]).position;
    const lastPosition = list.find((entry) => entry.id === ids[2]).position;
    await service.updateNotes(ids[2], 'Separate internal notes');
    await service.move(ids[2], {
      group: 'GROUP_4',
      previousPosition: lastPosition,
      position: firstPosition,
      reason: 'Synthetic priority reason',
    });
    const ordered = (await service.list())
      .filter((entry) => ids.includes(entry.id))
      .sort((left, right) => left.position - right.position);
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      [ids[2], ids[0], ids[1]],
    );
    const details = await service.details(ids[2]);
    assert.equal(details.history.filter((event) => event.type === 'REGISTERED').length, 1);
    assert.equal(details.history.filter((event) => event.type === 'GROUP_ASSIGNED').length, 1);
    assert.equal(details.groupHistoryIncomplete, false);
    assert.equal(details.internalNotes, 'Separate internal notes');
    assert.equal(details.history.filter((event) => event.type === 'POSITION_CHANGED').length, 1);
    assert.equal(
      details.history.filter((event) => event.type === 'POSITION_CHANGED')[0].previousPosition,
      lastPosition,
    );
    assert.equal(
      details.history.filter((event) => event.type === 'POSITION_CHANGED')[0].newPosition,
      firstPosition,
    );
    assert.equal(
      details.history.filter((event) => event.type === 'POSITION_CHANGED')[0].reason,
      'Synthetic priority reason',
    );
    await service.updateNotes(ids[2], '');
    assert.equal((await service.details(ids[2])).internalNotes, null);
    assert.equal(
      (await service.details(ids[2])).history.filter((event) => event.type === 'POSITION_CHANGED')
        .length,
      1,
    );
    await assert.rejects(
      service.move(ids[2], {
        group: 'GROUP_4',
        previousPosition: lastPosition,
        position: firstPosition,
        reason: 'Stale view',
      }),
      /Waiting position has changed/,
    );
    await assert.rejects(
      service.move(ids[2], {
        group: 'GROUP_3',
        previousPosition: firstPosition,
        position: firstPosition + 1,
        reason: 'Wrong group',
      }),
      /expected group/,
    );
    await assert.rejects(
      service.move(ids[2], {
        group: 'GROUP_4',
        previousPosition: firstPosition,
        position: firstPosition,
        reason: 'No change',
      }),
      /Target position/,
    );
    const size = (await service.list()).filter(
      (entry) => entry.group === 'GROUP_4' && entry.status === 'WAITING',
    ).length;
    await assert.rejects(
      service.move(ids[2], {
        group: 'GROUP_4',
        previousPosition: firstPosition,
        position: size + 1,
        reason: 'Out of bounds',
      }),
      /Target position/,
    );
    assert.equal(
      (await service.details(ids[2])).history.filter((event) => event.type === 'POSITION_CHANGED')
        .length,
      1,
    );
    // Inserting after a manual move must preserve the existing relative order.
    const newcomer = await tx.waitlistEntry.create({
      data: { ...sample, registeredAt: new Date('2000-01-01T12:00:00Z') },
    });
    await service.assign(newcomer.id, 'GROUP_4');
    const expected = [newcomer.id, ids[2], ids[0], ids[1]];
    const afterInsertion = (await service.list())
      .filter((entry) => expected.includes(entry.id))
      .sort((left, right) => left.position - right.position);
    assert.deepEqual(
      afterInsertion.map((entry) => entry.id),
      expected,
    );
    const transfer = await tx.waitlistEntry.create({
      data: { ...sample, registeredAt: new Date('2000-01-02T12:00:00Z') },
    });
    await service.assign(transfer.id, 'GROUP_3');
    await service.assign(transfer.id, 'GROUP_4');
    const transferExpected = [newcomer.id, transfer.id, ids[2], ids[0], ids[1]];
    const afterManualTransfer = (await service.list())
      .filter((entry) => transferExpected.includes(entry.id))
      .sort((left, right) => left.position - right.position);
    assert.deepEqual(
      afterManualTransfer.map((entry) => entry.id),
      transferExpected,
    );
    const currentPosition = afterManualTransfer.find((entry) => entry.id === ids[2]).position;
    const finalPosition = (await service.list()).filter(
      (entry) => entry.group === 'GROUP_4' && entry.status === 'WAITING',
    ).length;
    await service.move(ids[2], {
      group: 'GROUP_4',
      previousPosition: currentPosition,
      position: finalPosition,
      reason: 'Move toward queue end',
    });
    const stored = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: ids[2] } });
    assert.equal(stored.registeredAt.getTime(), created[2].registeredAt.getTime());
    assert.equal(
      (await service.details(ids[2])).history.filter((event) => event.type === 'POSITION_CHANGED')
        .length,
      2,
    );
    await assert.rejects(service.updateNotes(crypto.randomUUID(), 'Unknown'), /not found/);
    await assert.rejects(service.details(crypto.randomUUID()), /not found/);
  });
  await verifyWithRollback(async (tx) => {
    const service = createWaitlistService({
      waitlistEntry: tx.waitlistEntry,
      $transaction: (operation) => operation(tx),
    });
    const created = [];
    // Assign in reverse chronology to verify insertion uses registration time.
    for (const [index, date] of ['2000-01-01', '2000-01-02', '2000-01-03'].entries()) {
      created.push(
        await tx.waitlistEntry.create({
          data: {
            ...sample,
            firstName: `Queue example ${index}`,
            registeredAt: new Date(`${date}T00:00:00Z`),
          },
        }),
      );
    }
    for (const entry of [...created].reverse()) await service.assign(entry.id, 'GROUP_4');
    const ids = created.map((entry) => entry.id);
    const listed = await service.list();
    const assigned = listed
      .filter((entry) => ids.includes(entry.id))
      .sort((left, right) => left.position - right.position);
    assert.deepEqual(
      assigned.map((entry) => entry.id),
      ids,
    );
    assert.equal(assigned[0].birthDate, '2016-01-02');
    assert.ok(assigned.every((entry) => !('queueOrder' in entry) && !('internalNotes' in entry)));
    const before = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: ids[1] } });
    await service.assign(ids[1], 'GROUP_4');
    const unchanged = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: ids[1] } });
    assert.equal(unchanged.updatedAt.getTime(), before.updatedAt.getTime());
    await service.assign(ids[1], 'GROUP_3');
    const transferred = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: ids[1] } });
    assert.equal(transferred.registeredAt.getTime(), created[1].registeredAt.getTime());
    assert.equal(transferred.group, 'GROUP_3');
    const transferHistory = await service.details(ids[1]);
    assert.equal(
      transferHistory.history.filter((event) => event.type === 'GROUP_ASSIGNED').length,
      1,
    );
    assert.equal(
      transferHistory.history.filter((event) => event.type === 'GROUP_CHANGED').length,
      1,
    );
    assert.equal(await tx.waitlistGroupChange.count({ where: { entryId: ids[1] } }), 2);
    const afterTransfer = await service.list();
    for (const group of ['GROUP_3', 'GROUP_4']) {
      const waiting = afterTransfer
        .filter((entry) => entry.group === group && entry.status === 'WAITING')
        .sort((left, right) => left.position - right.position);
      assert.deepEqual(
        waiting.map((entry) => entry.position),
        waiting.map((_entry, index) => index + 1),
      );
    }
    const invited = await tx.waitlistEntry.create({
      data: { ...sample, status: 'INVITED', group: 'GROUP_4' },
    });
    assert.equal((await service.details(invited.id)).groupHistoryIncomplete, true);
    await assert.rejects(service.assign(invited.id, 'GROUP_3'), /Only unassigned or waiting/);
    await assert.rejects(
      service.assign(crypto.randomUUID(), 'GROUP_4'),
      /Waitlist entry not found/,
    );
    assert.equal((await service.list()).find((entry) => entry.id === invited.id).position, null);
  });
  await verifyWithRollback(async (tx) => {
    const id = crypto.randomUUID();
    const service = createWaitlistService({
      waitlistEntry: {
        create: (args) => tx.waitlistEntry.create({ ...args, data: { ...args.data, id } }),
      },
    });
    assert.deepEqual(
      await service.register({
        ...sample,
        birthDate: '2016-01-02',
        message: 'Synthetic registration',
      }),
      { status: 'received' },
    );
    const entry = await tx.waitlistEntry.findUniqueOrThrow({ where: { id } });
    assert.equal(entry.status, 'UNASSIGNED');
    assert.equal(entry.group, null);
    assert.equal(entry.queueOrder, null);
    assert.equal(entry.internalNotes, null);
    assert.equal(entry.statusTokenHash, null);
    assert.equal(entry.message, 'Synthetic registration');
    assert.equal(entry.birthDate.toISOString(), '2016-01-02T00:00:00.000Z');
    assert.deepEqual(entry.badges, sample.badges);
    assert.deepEqual(entry.swimmingStyles, sample.swimmingStyles);
  });
  await verifyWithRollback(async (tx) => {
    const entry = await tx.waitlistEntry.create({ data: sample });
    assert.equal(entry.status, 'UNASSIGNED');
    assert.equal(entry.group, null);
    assert.equal(entry.queueOrder, null);
    assert.equal(entry.birthDate.toISOString(), '2016-01-02T00:00:00.000Z');

    // Duplicate emails are allowed, including siblings using the same contact address.
    const sibling = await tx.waitlistEntry.create({
      data: { ...sample, firstName: 'Sibling', badges: ['DSA_BRONZE'] },
    });
    const largest = await tx.waitlistEntry.aggregate({
      where: { group: 'GROUP_4' },
      _max: { queueOrder: true },
    });
    const order = (largest._max.queueOrder ?? 0) + 1;
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { group: 'GROUP_4', status: 'WAITING', queueOrder: order },
    });
    await tx.waitlistEntry.update({
      where: { id: sibling.id },
      data: { group: 'GROUP_4', status: 'WAITING', queueOrder: order + 1 },
    });
    const ids = [entry.id, sibling.id];
    const waiting = await tx.waitlistEntry.findMany({
      where: { id: { in: ids }, status: 'WAITING', group: 'GROUP_4' },
      orderBy: { queueOrder: 'asc' },
    });
    assert.deepEqual(
      waiting.map((row) => row.id),
      ids,
    );

    await tx.waitlistEntry.update({ where: { id: entry.id }, data: { queueOrder: order + 2 } });
    await tx.waitlistOrderChange.create({
      data: {
        entryId: entry.id,
        group: 'GROUP_4',
        previousPosition: 1,
        newPosition: 2,
        reason: 'Synthetic verification example',
      },
    });
    const reordered = await tx.waitlistEntry.findMany({
      where: { id: { in: ids }, status: 'WAITING' },
      orderBy: { queueOrder: 'asc' },
    });
    assert.deepEqual(
      reordered.map((row) => row.id),
      [sibling.id, entry.id],
    );
    const updated = await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'INVITED', queueOrder: null },
    });
    assert.equal(updated.registeredAt.getTime(), entry.registeredAt.getTime());
    assert.equal(
      await tx.waitlistEntry.count({ where: { id: { in: ids }, status: 'WAITING' } }),
      1,
    );
  });

  await verifyWithRollback(async (tx) => {
    const database = {
      waitlistEntry: tx.waitlistEntry,
      $queryRaw: (...args) => tx.$queryRaw(...args),
      $transaction: (operation) => operation(tx),
    };
    const statusService = new WaitlistStatusService(database);
    const service = createWaitlistService(database);
    const entry = await tx.waitlistEntry.create({ data: sample });
    assert.equal(entry.statusTokenHash, null); // Existing and new registrations remain tokenless.
    const concurrentEntry = await tx.waitlistEntry.create({ data: sample });
    const attempts = await Promise.allSettled([
      statusService.issueToken(concurrentEntry.id, tx),
      statusService.issueToken(concurrentEntry.id, tx),
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
    const token = await statusService.issueToken(entry.id, tx);
    const stored = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert.equal(stored.statusTokenHash, hashStatusToken(token));
    assert.notEqual(stored.statusTokenHash, token);
    assert.deepEqual(await statusService.resolve(token), {
      status: 'UNASSIGNED',
      group: null,
      position: null,
    });
    await assert.rejects(statusService.issueToken(entry.id, tx), /could not be issued/);
    await assert.rejects(statusService.resolve('invalid'), /status not found/);
    await service.assign(entry.id, 'GROUP_4');
    const assigned = (await service.list()).find((row) => row.id === entry.id);
    assert.deepEqual(await statusService.resolve(token), {
      status: 'WAITING',
      group: 'GROUP_4',
      position: assigned.position,
    });
    const other = await tx.waitlistEntry.create({ data: sample });
    await service.assign(other.id, 'GROUP_4');
    const currentQueue = await service.list();
    const previousPosition = currentQueue.find((row) => row.id === entry.id).position;
    const size = currentQueue.filter(
      (row) => row.group === 'GROUP_4' && row.status === 'WAITING',
    ).length;
    await service.move(entry.id, {
      group: 'GROUP_4',
      previousPosition,
      position: previousPosition === 1 ? size : 1,
      reason: 'Synthetic token verification',
    });
    const moved = (await service.list()).find((row) => row.id === entry.id);
    assert.equal((await statusService.resolve(token)).position, moved.position);
    assert.notEqual(moved.position, previousPosition);
    await service.assign(entry.id, 'GROUP_3');
    const transferred = (await service.list()).find((row) => row.id === entry.id);
    assert.deepEqual(await statusService.resolve(token), {
      status: 'WAITING',
      group: 'GROUP_3',
      position: transferred.position,
    });
    assert.equal(
      (await tx.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).statusTokenHash,
      stored.statusTokenHash,
    );
    assert.ok(!('statusTokenHash' in transferred));
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'INVITED', queueOrder: null },
    });
    assert.deepEqual(await statusService.resolve(token), {
      status: 'INVITED',
      group: 'GROUP_3',
      position: null,
    });
    for (const status of ['ACCEPTED', 'CANCELLED']) {
      await tx.waitlistEntry.update({ where: { id: entry.id }, data: { status } });
      await assert.rejects(statusService.resolve(token), /status not found/);
      const closed = await tx.waitlistEntry.create({ data: { ...sample, status } });
      await assert.rejects(statusService.issueToken(closed.id, tx), /could not be issued/);
    }
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'INVITED', statusTokenHash: null },
    });
    await assert.rejects(statusService.resolve(token), /status not found/);
    const replacement = await statusService.issueToken(entry.id, tx);
    assert.notEqual(replacement, token);
    await assert.rejects(statusService.resolve(token), /status not found/);
    assert.equal((await statusService.resolve(replacement)).status, 'INVITED');
  });

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.waitlistEntry.create({ data: { ...sample, statusTokenHash: 'a'.repeat(64) } });
      await tx.waitlistEntry.create({ data: { ...sample, statusTokenHash: 'a'.repeat(64) } });
    }),
    /unique|Unique/,
  );
  await expectConstraint({ statusTokenHash: 'invalid' }, 'WaitlistEntry_statusTokenHash_check');
  await verifyWithRollback(async (tx) => {
    const database = {
      waitlistEntry: tx.waitlistEntry,
      $queryRaw: (...args) => tx.$queryRaw(...args),
      $transaction: (operation) => operation(tx),
    };
    const status = new WaitlistStatusService(database);
    const messages = [];
    let fail = false;
    const mail = {
      send: async (message) => {
        messages.push(message);
        if (fail) throw new Error('Synthetic SMTP failure');
        return 'sent';
      },
    };
    const links = new StatusLinkService(database, mail, status);
    const service = new WaitlistService(database, mail, links);
    const entry = await tx.waitlistEntry.create({ data: sample });
    await service.assign(entry.id, 'GROUP_4');
    assert.equal(messages.length, 1);
    let stored = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    assert.equal(stored.statusLinkDelivery, 'SENT');
    const token = /status#([A-Za-z0-9_-]{43})/.exec(messages[0].text)[1];
    assert.equal(stored.statusTokenHash, hashStatusToken(token));
    await service.assign(entry.id, 'GROUP_4');
    await service.assign(entry.id, 'GROUP_3');
    assert.equal(messages.length, 1);
    assert.equal((await status.resolve(token)).group, 'GROUP_3');
    const details = await service.details(entry.id);
    assert.equal(details.statusLinkDelivery.status, 'SENT');
    assert.equal(details.statusLinkDelivery.canSend, false);
    assert.ok(!JSON.stringify(details).includes(token));
    fail = true;
    const failed = await tx.waitlistEntry.create({ data: sample });
    await service.assign(failed.id, 'GROUP_4');
    stored = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: failed.id } });
    assert.equal(stored.status, 'WAITING');
    assert.equal(stored.statusLinkDelivery, 'FAILED');
    const previousToken = /status#([A-Za-z0-9_-]{43})/.exec(messages.at(-1).text)[1];
    fail = false;
    await links.send(failed.id);
    await assert.rejects(status.resolve(previousToken), /status not found/);
    const replacement = /status#([A-Za-z0-9_-]{43})/.exec(messages.at(-1).text)[1];
    assert.equal((await status.resolve(replacement)).status, 'WAITING');
    await assert.rejects(links.send(failed.id), /not available/);
    const legacy = await tx.waitlistEntry.create({
      data: { ...sample, status: 'INVITED', group: 'GROUP_4' },
    });
    assert.equal((await service.details(legacy.id)).statusLinkDelivery.canSend, true);
    // A pending legacy record can be sent once; real concurrent claims are checked by mail verification.
    await tx.waitlistEntry.update({
      where: { id: legacy.id },
      data: { statusLinkDelivery: 'PENDING' },
    });
    const before = messages.length;
    await links.sendAutomatic(legacy.id);
    assert.equal(messages.length, before + 1);
    const uncertain = await tx.waitlistEntry.create({
      data: {
        ...sample,
        status: 'INVITED',
        group: 'GROUP_3',
        statusLinkDelivery: 'SENDING',
        statusLinkAttemptId: crypto.randomUUID(),
        statusLinkAttemptAt: new Date(Date.now() - 121000),
      },
    });
    assert.equal((await service.details(uncertain.id)).statusLinkDelivery.status, 'UNKNOWN');
    await links.send(uncertain.id);
    assert.equal((await service.details(uncertain.id)).statusLinkDelivery.status, 'SENT');
  });

  await expectConstraint({ badges: [] }, 'WaitlistEntry_badges_check');
  await expectConstraint({ swimmingStyles: [] }, 'WaitlistEntry_swimmingStyles_check');
  await expectConstraint({ firstName: '   ' }, 'WaitlistEntry_required_text_check');
  await expectConstraint(
    { status: 'WAITING', group: 'GROUP_4' },
    'WaitlistEntry_waiting_assignment_check',
  );
  await expectConstraint({ group: 'GROUP_4' }, 'WaitlistEntry_unassigned_group_check');
  await expectConstraint(
    { status: 'INVITED', group: 'GROUP_4', queueOrder: 1 },
    'WaitlistEntry_waiting_assignment_check',
  );

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const entry = await tx.waitlistEntry.create({ data: sample });
      await tx.waitlistOrderChange.create({
        data: {
          entryId: entry.id,
          group: 'GROUP_4',
          previousPosition: 1,
          newPosition: 2,
          reason: '   ',
        },
      });
      throw rollback;
    }),
    (error) => error !== rollback && String(error).includes('WaitlistOrderChange_reason_check'),
  );

  console.log('Waitlist schema verification passed; all synthetic records were rolled back.');
} finally {
  await prisma.$disconnect();
}
