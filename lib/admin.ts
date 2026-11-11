export function isAdminUid(uid: string) {
  const adminUids = (process.env.ADMIN_UIDS || '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return adminUids.includes(uid);
}