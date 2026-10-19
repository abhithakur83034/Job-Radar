// Free plan search-profile cap (doc 5.2 pricing table). Active Search and
// Career Boost are unlimited — see "8.5 Search Profile Settings — manage
// multiple search profiles on paid plans."
export const FREE_PROFILE_LIMIT = 3;

export function canAddSearchProfile(plan: string, currentCount: number): boolean {
  if (plan === "free") return currentCount < FREE_PROFILE_LIMIT;
  return true;
}
