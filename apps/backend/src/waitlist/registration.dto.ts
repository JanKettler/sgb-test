import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { SwimmingBadge, SwimmingStyle } from '../generated/prisma/enums.js';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

@ValidatorConstraint({ name: 'birthDate', async: false })
export class BirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= '0001-01-01' &&
      value <= new Date().toISOString().slice(0, 10)
    );
  }

  defaultMessage(): string {
    return 'birthDate must be a valid date in YYYY-MM-DD format and must not be in the future';
  }
}

export class RegistrationDto {
  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  lastName!: string;

  @Validate(BirthDateConstraint)
  birthDate!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(SwimmingBadge, { each: true })
  badges!: SwimmingBadge[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(SwimmingStyle, { each: true })
  swimmingStyles!: SwimmingStyle[];

  @Transform(trim)
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  message?: string;
}
