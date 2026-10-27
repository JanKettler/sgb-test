import { Body, Controller, Inject, Post, ValidationPipe } from '@nestjs/common';
import { RegistrationDto } from './registration.dto.js';
import { WaitlistService } from './waitlist.service.js';

@Controller('public/waitlist/registrations')
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  @Post()
  register(
    @Body(
      new ValidationPipe({
        expectedType: RegistrationDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    registration: RegistrationDto,
  ): Promise<{ status: 'received' }> {
    return this.waitlist.register(registration);
  }
}
