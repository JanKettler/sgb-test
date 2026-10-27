import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module.js';
import { WaitlistController } from './waitlist.controller.js';
import { WaitlistService } from './waitlist.service.js';
import { WaitlistAdminController } from './waitlist-admin.controller.js';
import { DevelopmentAccessGuard } from './development-access.guard.js';
import { MailModule } from '../mail/mail.module.js';
import { WaitlistStatusService } from './waitlist-status.service.js';
import { WaitlistStatusController } from './waitlist-status.controller.js';
import { statusResponseHeaders } from './status-response.middleware.js';
import { StatusLinkService } from './status-link.service.js';

@Module({
  imports: [DatabaseModule, MailModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
  controllers: [WaitlistController, WaitlistAdminController, WaitlistStatusController],
  providers: [WaitlistService, DevelopmentAccessGuard, WaitlistStatusService, StatusLinkService],
  exports: [WaitlistStatusService],
})
export class WaitlistModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(statusResponseHeaders).forRoutes(WaitlistStatusController);
  }
}
