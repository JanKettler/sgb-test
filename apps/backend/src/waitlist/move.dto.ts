import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
import { SwimmingGroup } from '../generated/prisma/enums.js';

export class MoveDto {
  @IsEnum(SwimmingGroup)
  group!: SwimmingGroup;

  @IsInt()
  @Min(1)
  previousPosition!: number;

  @IsInt()
  @Min(1)
  position!: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  reason!: string;
}
