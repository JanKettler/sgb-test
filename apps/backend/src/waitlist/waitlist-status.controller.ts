import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WaitlistStatusService } from './waitlist-status.service.js';
import { StatusExceptionFilter } from './status-exception.filter.js';

@Controller('public/waitlist/status')
@UseGuards(ThrottlerGuard)
@UseFilters(StatusExceptionFilter)
export class WaitlistStatusController {
  constructor(
    @Inject(WaitlistStatusService) private readonly waitlistStatus: WaitlistStatusService,
  ) {}

  // POST keeps the bearer token out of URLs and ordinary access logs. This is read-only.
  @Post()
  @HttpCode(200)
  resolve(@Body() body: unknown) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('token' in body) ||
      typeof body.token !== 'string'
    )
      throw new NotFoundException('Waitlist status not found');
    return this.waitlistStatus.resolve(body.token);
  }
}
