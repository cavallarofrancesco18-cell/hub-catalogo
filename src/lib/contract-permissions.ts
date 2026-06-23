const CONTRACT_CREATION_BLOCKED_EMAILS = ['gp@gruppodinamica.com'];

export function isContractCreationBlocked(email?: string | null) {
  if (!email) {
    return false;
  }

  return CONTRACT_CREATION_BLOCKED_EMAILS.includes(email.trim().toLowerCase());
}

export function canManageContracts(role?: 'admin' | 'seller' | 'agent' | null) {
  return role === 'admin' || role === 'seller';
}
