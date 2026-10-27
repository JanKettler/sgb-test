import { Injectable, OnModuleDestroy } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getMailConfig } from './mail.config.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly configuration = getMailConfig();
  private readonly transport = this.configuration
    ? nodemailer.createTransport(this.configuration.transport)
    : null;

  async send(message: MailMessage): Promise<'sent' | 'disabled'> {
    if (!this.transport || !this.configuration) return 'disabled';
    const result = await this.transport.sendMail({
      from: { name: 'SGB Portal', address: this.configuration.from },
      to: { address: message.to, name: '' },
      subject: message.subject,
      text: message.text,
    });
    if (result.accepted.length !== 1 || result.rejected.length > 0)
      throw new Error('SMTP server did not accept the recipient');
    return 'sent';
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
