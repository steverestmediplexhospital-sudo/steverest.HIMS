const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const flatRoles = roles.flat();
    if (!flatRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Required: ${flatRoles.join(", ")}` });
    }
    next();
  };
};

// requireRole is the same as allowRoles - just aliased
const requireRole = allowRoles;

const denyRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (roles.flat().includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
};

module.exports = { allowRoles, requireRole, denyRoles };
