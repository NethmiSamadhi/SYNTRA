export function validateEmail(email: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) return 'Email is required';
  if (!re.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Include at least one number';
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name is too short';
  return null;
}