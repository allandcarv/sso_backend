const bcrypt = require('bcryptjs');

module.exports = app => {
    const { existsOrError, notExistsOrError, equalsOrError } = app.api.validations;

    const internalError = err => {
        return { userErr: 'Internal Server Error', err };
    };

    const encryptPassword = password => {
        const salt = bcrypt.genSaltSync(10);
        return bcrypt.hashSync(password, salt);
    }

    const save = async (req, res) => {
        const user = { ...req.body };

        try {
            existsOrError(user.name, 'Faltando nome do Usuário');
            existsOrError(user.email, 'Faltando email do Usuário');
            existsOrError(user.password, 'Faltando senha do Usuário');
            existsOrError(user.confirmPassword, 'Faltando confirmação de senha do Usuário');
            existsOrError(user.admin, 'Faltando opção de administrador');
            existsOrError(user.department_id, 'Faltando departamento do Usuário');
            equalsOrError(user.password, user.confirmPassword, 'Senhas não conferem');

            const checkDepartmentID = await app.db('departments').where({ id: user.department_id }).select('id').first();
            const checkMail = await app.db('users').select('id').where({ email: user.email }).select('id').first();
            existsOrError(checkDepartmentID, 'Departamento não encontrado')
            notExistsOrError(checkMail, 'Email já cadastrado');
        } catch (err) {
            return res.status(400).json({ err });
        }

        user.password = encryptPassword(user.password);
        delete user.confirmPassword;

        app.db('users')
            .insert(user)
            .then(() => res.status(201).send())
            .catch(err => res.status(500).json(internalError(err)));

    }

    const update = async (req, res) => {
        const user = { ...req.body };
        const id = req.params.id;

        if (!req.user.admin && req.user.id != id) return res.status(401).json({ err: 'Usuário sem permissão. '});

        try {
            notExistsOrError(user.id, 'Campo não permitido');
            notExistsOrError(user.deleted_at, 'Campo não permitido')

            if (user.email) {
                const userFromDB = await app.db('users').select('*').where({ email: user.email }).first();
                notExistsOrError(userFromDB, 'Usuário já cadastrado');
            }

            if (user.password) {
                existsOrError(user.confirmPassword, 'Faltando confirmação de senha do Usuário');
                equalsOrError(user.password, user.confirmPassword, 'Senhas não conferem');
            }

        } catch (err) {
            return res.status(400).json({ err });
        }

        if (user.password) {
            user.password = encryptPassword(user.password);
            delete user.confirmPassword;
        }

        app.db('users')
            .where({ id })
            .whereNull('deleted_at')
            .update(user)
            .then(data => {
                try {
                    existsOrError(data, 'Usuário não encontrado');
                } catch (err) {
                    return res.status(404).json({ err });
                }

                return res.status(200).send();
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const get = async (req, res) => {
        const limit = 10;
        const page = req.query.page || 1;
        const result = await app.db('users').whereNull('deleted_at').count('id').first();
        const count = Object.values(result)[0];

        app.db('users')
            .whereNull('deleted_at')
            .select('id', 'name', 'email', 'admin', 'department_id')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id')
            .then(data => res.status(200).json({ data, count, limit }))
            .catch(err => res.status(500).json(internalError(err)))

    }

    const getByUserId = (req, res) => {
        const id = req.params.id;

        if (!req.user.admin && req.user.id != id) return res.status(401).json({ err: 'Usuário sem permissão. '});

        app.db('users')
            .select('id', 'name', 'email', 'admin', 'department_id')
            .whereNull('deleted_at')
            .where({ id })
            .limit(1)
            .first()
            .then(data => {
                try {
                    existsOrError(data, 'Usuário não encontrado');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const remove = async (req, res) => {
        const id = req.params.id;

        try {
            const checkArticles = await app.db('solicitations').where({ user_id: id }).whereNull('closing_date').select('id').first();
            notExistsOrError(checkArticles, 'Usuário possui Solicitações');           
            
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('users')
            .where({ id })
            .whereNull('closing_date')
            .update({ deleted_at: new Date() })
            .then(data => {
                try {
                    existsOrError(data, 'Usuário não encontrado');
                    return res.status(204).send();
                } catch (err) {
                    return res.status(404).json({ err })
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, update, get, getByUserId, remove };
}