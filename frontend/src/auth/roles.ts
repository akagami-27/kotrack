export function isAdminRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export function isSuperAdminRole(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN'
}
