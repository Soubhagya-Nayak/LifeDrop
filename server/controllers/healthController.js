const pool = require('../config/db');

exports.submitHealth = async (req, res) => {
    const { age, weight, has_fever, has_hiv, has_hepatitis, recent_surgery } = req.body;
    const user_id = req.user.id;

    let eligibility_status = 'Eligible';
    if (age < 18 || age > 60 || weight < 50 || has_fever || has_hiv || has_hepatitis || recent_surgery) {
        eligibility_status = 'Ineligible';
    }

    try {
        const [existing] = await pool.query('SELECT * FROM HealthInfo WHERE user_id = ?', [user_id]);
        if (existing.length > 0) {
            await pool.query(
                'UPDATE HealthInfo SET age=?, weight=?, has_fever=?, has_hiv=?, has_hepatitis=?, recent_surgery=?, eligibility_status=? WHERE user_id=?',
                [age, weight, has_fever, has_hiv, has_hepatitis, recent_surgery, eligibility_status, user_id]
            );
        } else {
            await pool.query(
                'INSERT INTO HealthInfo (user_id, age, weight, has_fever, has_hiv, has_hepatitis, recent_surgery, eligibility_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [user_id, age, weight, has_fever, has_hiv, has_hepatitis, recent_surgery, eligibility_status]
            );
        }
        res.json({ msg: 'Health info submitted', eligibility_status });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
