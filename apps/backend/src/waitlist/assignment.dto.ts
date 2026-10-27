import { IsEnum } from 'class-validator';
import { SwimmingGroup } from '../generated/prisma/enums.js';

export class AssignmentDto {
  @IsEnum(SwimmingGroup)
  group!: SwimmingGroup;
}
