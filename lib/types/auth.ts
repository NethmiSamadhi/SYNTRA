export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// Stored record includes the (hashed) password — never exposed via `User`
export interface StoredUser extends User {
  passwordHash: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}