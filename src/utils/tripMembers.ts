import { User } from '@/types/auth';

export type MemberLike = {
  id?: string;
  userId?: string;
  user?: Partial<User>;
  [key: string]: any;
};

/**
 * Deduplicate a list of trip members and filter out the owner if ownerId is provided.
 * Ensures no duplicate members appear by userId or id.
 */
export function filterTripMembers<T extends MemberLike>(
  members?: T[] | null,
  ownerId?: string
): T[] {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: T[] = [];

  for (const m of members) {
    if (!m) continue;
    const uid = m.userId || m.user?.id || m.id;
    if (!uid) continue;

    // Exclude trip owner from the non-owner member list
    if (ownerId && uid === ownerId) {
      continue;
    }

    if (!seen.has(uid)) {
      seen.add(uid);
      result.push(m);
    }
  }

  return result;
}

/**
 * Returns total unique member count including the trip owner.
 */
export function getTripMemberCount<T extends MemberLike>(
  members?: T[] | null,
  ownerId?: string
): number {
  const filtered = filterTripMembers(members, ownerId);
  return ownerId ? 1 + filtered.length : Math.max(1, filtered.length);
}
