import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DevelopmentAccessGuard implements CanActivate {
  canActivate(): boolean {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.ENABLE_DEV_WAITLIST_ADMIN !== 'true'
    ) {
      throw new NotFoundException();
    }
    return true;
  }
}
