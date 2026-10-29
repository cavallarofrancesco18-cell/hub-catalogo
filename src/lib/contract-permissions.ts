const CONTRACT_CREATION_BLOCKED_EMAILS = ['gp@gruppodinamica.com'];

export function isContractCreationBlocked(email?: string | null) {
  if (!email) {
    return false;
  }

  return CONTRACT_CREATION_BLOCKED_EMAILS.includes(email.trim().toLowerCase());
}

export function isStandardSeller(role?: 'admin' | 'seller' | 'agent' | null, sellerType?: string | null) {
  const normalizedType = sellerType?.trim().toUpperCase();
  return role === 'seller' && (!normalizedType || normalizedType === 'STANDARD');
}

export function canManageContracts(role?: 'admin' | 'seller' | 'agent' | null, sellerType?: string | null) {
  return role === 'admin' || (role === 'seller' && !isStandardSeller(role, sellerType));
}
