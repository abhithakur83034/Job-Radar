/** Use after requireAuth: allows only users whose role is "admin". */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  return next();
}
