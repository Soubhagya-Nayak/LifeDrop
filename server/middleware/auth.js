const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const header = req.header('Authorization');
    if (!header) return res.status(401).json({ msg: 'No token, authorization denied' });

    const token = header.split(' ')[1];
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
