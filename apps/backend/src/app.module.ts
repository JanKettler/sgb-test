import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';

@Module({
  imports: [HealthModule, DatabaseModule, WaitlistModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
