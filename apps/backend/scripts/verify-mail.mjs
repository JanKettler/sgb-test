import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getMailConfig } from '../dist/mail/mail.config.js';
import { MailService } from '../dist/mail/mail.service.js';
import { registrationReceipt } from '../dist/waitlist/registration-receipt.js';
import { PrismaService } from '../dist/database/prisma.service.js';
import { WaitlistStatusService } from '../dist/waitlist/waitlist-status.service.js';
import { StatusLinkService } from '../dist/waitlist/status-link.service.js';

const configuration = getMailConfig();
assert.ok(configuration, 'MAIL_ENABLED=true is required for local SMTP verification');
assert.ok(
  ['127.0.0.1', 'localhost', '::1'].includes(configuration.transport.host),
  'Run this check against local Mailpit only',
);
const baseUrl = `http://127.0.0.1:${process.env.MAILPIT_UI_PORT || '8025'}`;
const recipient = `verification-${randomUUID()}@example.invalid`;
const receipt = registrationReceipt({
  firstName: 'Synthetic',
  lastName: 'Mail verification',
  email: recipient,
});
const mail = new MailService();
let messageId;
const messageIds = [];
const prisma = new PrismaService();
let entryId;

async function api(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(response.ok, `Mailpit API returned HTTP ${response.status}`);
  return response;
}

try {
  assert.equal(await mail.send(receipt), 'sent');
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await (
      await api(`/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`)
    ).json();
    messageId = result.messages?.[0]?.ID;
    if (messageId) break;
    await delay(100);
  }
  assert.ok(messageId, 'The synthetic receipt did not appear in Mailpit');
  messageIds.push(messageId);
  const message = await (await api(`/api/v1/message/${messageId}`)).json();
  assert.equal(message.Subject, receipt.subject);
  assert.ok(message.Text.includes('Synthetic Mail verification'));
  assert.ok(message.Text.includes('noch keinen festgelegten Warteplatz'));
  console.log('SMTP receipt verification passed.');
  const entry = await prisma.waitlistEntry.create({
    data: {
      firstName: 'Synthetic',
      lastName: 'Status link verification',
      birthDate: new Date('2016-01-01'),
      email: recipient,
      badges: ['SEAHORSE'],
      swimmingStyles: ['BREASTSTROKE'],
      status: 'INVITED',
      group: 'GROUP_4',
      statusLinkDelivery: 'PENDING',
      internalNotes: 'Never include internal notes in mail',
    },
  });
  entryId = entry.id;
  const status = new WaitlistStatusService(prisma);
  const delivery = new StatusLinkService(prisma, mail, status);
  await Promise.all([delivery.sendAutomatic(entry.id), delivery.sendAutomatic(entry.id)]);
  let statusMessageId;
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await (
      await api(`/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`)
    ).json();
    const statusMessages = result.messages?.filter((item) => item.ID !== messageId) || [];
    assert.ok(
      statusMessages.length <= 1,
      'Concurrent claims generated duplicate status-link messages',
    );
    statusMessageId = statusMessages[0]?.ID;
    if (statusMessageId) break;
    await delay(100);
  }
  assert.ok(statusMessageId, 'The synthetic status-link message did not appear in Mailpit');
  messageIds.push(statusMessageId);
  const statusMessage = await (await api(`/api/v1/message/${statusMessageId}`)).json();
  assert.equal(statusMessage.Subject, 'SGB Portal – Dein Statuslink zur Warteliste');
  const link = /https?:\/\/[^\s]+\/warteliste\/status#[A-Za-z0-9_-]{43}/.exec(
    statusMessage.Text,
  )?.[0];
  assert.ok(link, 'The status-link message did not contain a fragment-based URL');
  const token = new URL(link).hash.slice(1);
  assert.deepEqual(await status.resolve(token), {
    status: 'INVITED',
    group: 'GROUP_4',
    position: null,
  });
  assert.ok(!statusMessage.Text.includes(entry.internalNotes));
  assert.equal(
    (await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).statusLinkDelivery,
    'SENT',
  );
  console.log(
    'SMTP status-link verification passed; the mailed token resolves through the status service.',
  );
} finally {
  mail.onModuleDestroy();
  if (entryId) await prisma.waitlistEntry.deleteMany({ where: { id: entryId } });
  await prisma.$disconnect();
  if (messageIds.length) {
    await api('/api/v1/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: messageIds }),
    });
    console.log('The synthetic verification emails were removed from Mailpit.');
  }
}
