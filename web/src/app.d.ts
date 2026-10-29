declare global {
  namespace App {
    interface Locals {
      member: { id: number; subject: string; displayName: string; roles: ('current-member' | 'alumni')[] } | null;
      memberAccessToken: string | null;
    }
  }
}
export {};
