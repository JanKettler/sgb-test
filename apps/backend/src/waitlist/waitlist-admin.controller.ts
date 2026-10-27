import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  HttpCode,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AssignmentDto } from './assignment.dto.js';
import { DevelopmentAccessGuard } from './development-access.guard.js';
import { WaitlistService } from './waitlist.service.js';
import { NotesDto } from './notes.dto.js';
import { MoveDto } from './move.dto.js';
import { StatusLinkService } from './status-link.service.js';

function validate(expectedType: typeof NotesDto | typeof MoveDto): ValidationPipe {
  return new ValidationPipe({
    expectedType,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  });
}

@Controller('internal/waitlist')
@UseGuards(DevelopmentAccessGuard)
export class WaitlistAdminController {
  constructor(
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
    @Inject(StatusLinkService) private readonly statusLinks: StatusLinkService,
  ) {}

  @Post(':id/status-link')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  sendStatusLink(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.statusLinks.send(id);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.waitlist.list();
  }

  @Get(':id/details')
  @Header('Cache-Control', 'no-store')
  details(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.waitlist.details(id);
  }

  @Patch(':id/notes')
  @Header('Cache-Control', 'no-store')
  updateNotes(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(validate(NotesDto)) notes: NotesDto,
  ) {
    return this.waitlist.updateNotes(id, notes.internalNotes);
  }

  @Patch(':id/position')
  @Header('Cache-Control', 'no-store')
  move(@Param('id', new ParseUUIDPipe()) id: string, @Body(validate(MoveDto)) move: MoveDto) {
    return this.waitlist.move(id, move);
  }

  @Patch(':id/group')
  @Header('Cache-Control', 'no-store')
  assign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(
      new ValidationPipe({
        expectedType: AssignmentDto,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }),
    )
    assignment: AssignmentDto,
  ) {
    return this.waitlist.assign(id, assignment.group);
  }
}
