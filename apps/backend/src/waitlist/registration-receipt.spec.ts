import { registrationReceipt } from './registration-receipt.js';

describe('Registration receipt', () => {
  it('contains only the name and receipt information', () => {
    const receipt = registrationReceipt({
      firstName: 'Example',
      lastName: 'Swimmer',
      email: 'example@example.invalid',
    });
    expect(receipt.to).toBe('example@example.invalid');
    expect(receipt.text).toContain('Example Swimmer');
    expect(receipt.text).toContain('noch keinen festgelegten Warteplatz');
    expect(receipt.text).toContain('keine Zusage');
  });
});
