export const ADMIN_USER_IDS: string[] = [
  'd6e92e39-c207-47e7-87f8-7cb4d66be1fa',
]

export function isAdminUser(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId)
}
