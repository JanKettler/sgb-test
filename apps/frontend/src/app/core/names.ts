/** The first word of a name: "Jonas Weber" becomes "Jonas". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** Whether a name belongs to an account: an account with only a first name takes that first name. */
export function sameOwner(owner: string, account: string): boolean {
  const left = owner.trim().toLocaleLowerCase('de');
  const right = account.trim().toLocaleLowerCase('de');
  if (!left || !right) return false;
  return left === right || (!right.includes(' ') && left.split(' ')[0] === right);
}
