const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authSecret } = require('../.env');

module.exports = app => {
    const signin = async (req, res) => { 
        if( !req.body.email || !req.body.password) {
            return res.status(400).json({ err: 'Informe usuário e senha '});
        }

        const user = await app.db('users').where({ email: req.body.email }).whereNull('deleted_at').first();

        if (!user) {
            return res.status(401).json({ err: 'Usuário não encontrado '});
        }

        const checkPass = bcrypt.compareSync(req.body.password, user.password);

        if (!checkPass) {
            return res.status(401).json({ err: 'Senha inválida '});
        }

        const now = Math.floor(Date.now() / 1000); // Converte em segundos
        const exp = now + (60 * 60 * 24); // Validade de 1 dia

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            admin: user.admin,
            iat: now,
            exp
        }

        res.status(200).json({
            ...payload,
            token: jwt.sign(payload, authSecret)
        });
    }

    return { signin };
}