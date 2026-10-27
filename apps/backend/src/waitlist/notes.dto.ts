import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class NotesDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000)
  internalNotes!: string;
}
