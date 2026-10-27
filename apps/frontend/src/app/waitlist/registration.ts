import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';

type Badge = 'SEAHORSE' | 'DSA_BRONZE' | 'DSA_SILVER' | 'DSA_GOLD';
type SwimmingStyle = 'BUTTERFLY' | 'BACKSTROKE' | 'BREASTSTROKE' | 'FREESTYLE';

function validateBirthDate(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { birthDate: true };
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '0001-01-01' &&
    value <= new Date().toISOString().slice(0, 10)
    ? null
    : { birthDate: true };
}

@Component({
  selector: 'app-waitlist-registration',
  imports: [ReactiveFormsModule],
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class Registration {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly badgeOptions: { value: Badge; label: string }[] = [
    { value: 'SEAHORSE', label: 'Seepferdchen' },
    { value: 'DSA_BRONZE', label: 'DSA Bronze' },
    { value: 'DSA_SILVER', label: 'DSA Silber' },
    { value: 'DSA_GOLD', label: 'DSA Gold' },
  ];
  protected readonly styleOptions: { value: SwimmingStyle; label: string }[] = [
    { value: 'BUTTERFLY', label: 'Schmetterling' },
    { value: 'BACKSTROKE', label: 'Rücken' },
    { value: 'BREASTSTROKE', label: 'Brust' },
    { value: 'FREESTYLE', label: 'Kraul' },
  ];
  readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    birthDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validateBirthDate],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    badges: new FormControl<Badge[]>([], { nonNullable: true, validators: [Validators.required] }),
    swimmingStyles: new FormControl<SwimmingStyle[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected toggleBadge(value: Badge, checked: boolean): void {
    const control = this.form.controls.badges;
    control.setValue(
      checked ? [...control.value, value] : control.value.filter((item) => item !== value),
    );
    control.markAsTouched();
  }

  protected toggleStyle(value: SwimmingStyle, checked: boolean): void {
    const control = this.form.controls.swimmingStyles;
    control.setValue(
      checked ? [...control.value, value] : control.value.filter((item) => item !== value),
    );
    control.markAsTouched();
  }

  protected submit(): void {
    if (this.state() === 'submitting') return;
    for (const field of ['firstName', 'lastName', 'email', 'message'] as const) {
      const control = this.form.controls[field];
      control.setValue(control.value.trim());
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    const { message, ...requiredFields } = values;
    this.state.set('submitting');
    this.form.disable();
    this.http
      .post<{ status: 'received' }>('/api/public/waitlist/registrations', {
        ...requiredFields,
        ...(message ? { message } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.form.enable();
          if (response.status === 'received') {
            this.form.reset();
            this.state.set('success');
          } else {
            this.state.set('error');
          }
        },
        error: () => {
          this.form.enable();
          this.state.set('error');
        },
      });
  }

  protected startAgain(): void {
    this.form.reset();
    this.state.set('idle');
  }
}
