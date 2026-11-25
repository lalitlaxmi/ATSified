const roles = require('../data/roles.json');
module.exports = (req, res) => res.json(Object.entries(roles).map(([id, r]) => ({ id, name: r.name })));
