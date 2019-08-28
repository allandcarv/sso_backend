const moment = require('moment');

const emails = require('../config/emails');

module.exports = app => {
    const { existsOrError, notExistsOrError, checkAccess } = app.api.validations;

    const internalError = msg => {
        return { err: 'Essa não, erro no servidor!!! :(', devMsg: msg };
    };

    const save = async (req, res) => {
        const solicitation = { ...req.body };
        solicitation.user_id = req.user.id;
        solicitation.opening_date = moment().format('YYYY-MM-DD');

        try {
            existsOrError(solicitation.subject, 'Faltando o assunto da solicitação');
            existsOrError(solicitation.description, 'Faltando a descrição da solicitação');
            existsOrError(solicitation.category_id, 'Faltando a categoria da solicitação');
            notExistsOrError(solicitation.id, 'Campo não permitido');
            notExistsOrError(solicitation.ticket, 'Campo não permitido');
            notExistsOrError(solicitation.closing_date, 'Campo não permitido');

            const checkCategoryId = await app.db('categories').where({ id: solicitation.category_id }).select('id').limit(1).first();
            existsOrError(checkCategoryId, 'Categoria não encontrada');
        } catch (err) {
            return res.status(400).json({ err });
        }

        const lastTicket = await app.db('solicitations').select('ticket').orderBy('id', 'desc').limit(1).first();
        let ticketNumber = 0000;
        let ticketYear = 0000;

        const year = moment().format('YYYY');

        if (lastTicket) {
            ticketNumber = parseInt(lastTicket.ticket.substring(0, 4));
            ticketYear = lastTicket.ticket.substring(5);
        }

        if (ticketYear !== year) {
            solicitation.ticket = `0001/${year}`;
        } else {
            ticketNumber += 1;
            ticketNumber = ticketNumber.toString().padStart(4, 0);
            solicitation.ticket = `${ticketNumber}/${ticketYear}`
        }

        app.db('solicitations')
            .insert(solicitation)
            .then(data => {
                solicitation.id = data;
                solicitation.user = req.user.name;
                solicitation.user_email = req.user.email;
                
                emails.sendOpenMail(app.db, solicitation);

                return res.status(200).send();
            })
            .catch(err => res.status(500).json(err));
    }

    const update = async (req, res) => {
        const solicitation = {
            subject: req.body.subject,
            description: req.body.description,
            expected_date: req.body.expected_date ? moment(req.body.expected_date).format('YYYY-MM-DD') : null
        };
        solicitation.id = req.params.id;

        if (req.user.id !== req.body.user_id) {
            return res.status(401).json({ err: 'Usuário não autorizado' });
        }

        app.db('solicitations')
            .where({ id: solicitation.id })
            .whereNull('closing_date')
            .update(solicitation)
            .then(data => {
                try {
                    existsOrError(data, 'Solicitação não encontrada')
                } catch (err) {
                    return res.status(404).json({ err });
                }

                return res.status(200).send();
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const limit = 10;

    const getWithFilter = async function (knexFilter, page, count, res) {

        const queryBuilder = builder => {
            if (knexFilter.ticket) builder.where('ticket', 'like', `%${knexFilter.ticket}%`)
            if (knexFilter.subject) builder.where('subject', 'like', `%${knexFilter.subject}%`)
            if (knexFilter.opening_date) builder.where('opening_date', 'like', `%${knexFilter.opening_date}%`)
            if (knexFilter.expected_date) builder.where('expected_date', 'like', `%${knexFilter.expected_date}%`)
            if (knexFilter.user_id) builder.where('user_id', '=', knexFilter.user_id)
            if (knexFilter.category_id) builder.where('category_id', '=', knexFilter.category_id)
            if (knexFilter.opening_dateFrom) {
                if (!knexFilter.opening_dateTo) {
                    knexFilter.opening_dateTo = moment(new Date()).format('YYYY-MM-DD');
                }
                builder.where('opening_date', '>=', knexFilter.opening_dateFrom).andWhere('opening_date', '<=', knexFilter.opening_dateTo);
            }
            if (knexFilter.expected_dateFrom) {
                if (!knexFilter.expected_dateTo) {
                    knexFilter.expected_dateTo = moment(new Date()).format('YYYY-MM-DD');
                }
                builder.where('expected_date', '>=', knexFilter.expected_dateFrom).andWhere('expected_date', '<=', knexFilter.expected_dateTo);
            }
        }        

        app.db({ s: 'solicitations' })
            .join('categories', 'categories.id', '=', 's.category_id')
            .join('users', 'users.id', '=', 's.user_id')
            .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.user_id', 's.category_id')
            .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
            .whereNull('closing_date')
            .where(queryBuilder)
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getClosedWithFilter = async function (knexFilter, page, res) {

        const queryBuilder = builder => {
            if (knexFilter.ticket) builder.where('ticket', 'like', `%${knexFilter.ticket}%`)
            if (knexFilter.subject) builder.where('subject', 'like', `%${knexFilter.subject}%`)
            if (knexFilter.opening_date) builder.where('opening_date', 'like', `%${knexFilter.opening_date}%`)
            if (knexFilter.expected_date) builder.where('expected_date', 'like', `%${knexFilter.expected_date}%`)
            if (knexFilter.user_id) builder.where('user_id', '=', knexFilter.user_id)
            if (knexFilter.category_id) builder.where('category_id', '=', knexFilter.category_id)
            if (knexFilter.department_id) builder.where('categories.department_id', '=', knexFilter.department_id)
            if (knexFilter.opening_dateFrom) {
                if (!knexFilter.opening_dateTo) {
                    knexFilter.opening_dateTo = moment(new Date()).format('YYYY-MM-DD');
                }
                builder.where('opening_date', '>=', knexFilter.opening_dateFrom).andWhere('opening_date', '<=', knexFilter.opening_dateTo);
            }
            if (knexFilter.expected_dateFrom) {
                if (!knexFilter.expected_dateTo) {
                    knexFilter.expected_dateTo = moment(new Date()).format('YYYY-MM-DD');
                }
                builder.where('expected_date', '>=', knexFilter.expected_dateFrom).andWhere('expected_date', '<=', knexFilter.expected_dateTo);
            }
        }

        const result = await app.db('solicitations').whereNotNull('closing_date').where(queryBuilder).count('id').first();
        const count = Object.values(result)[0];

        app.db({ s: 'solicitations' })
            .join('categories', 'categories.id', '=', 's.category_id')
            .join('users', 'users.id', '=', 's.user_id')
            .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.closing_date', 's.user_id', 's.category_id')
            .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
            .whereNotNull('closing_date')
            .where(queryBuilder)
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));
    }

    const get = async (req, res) => {

        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            getWithFilter(knexFilter, page, res);
        } else {
            const result = await app.db('solicitations').whereNull('closing_date').count('id').first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }

    const getById = async (req, res) => {
        const solicitationId = req.params.id;

        const hasAccess = await checkAccess(req.user.id, req.user.department, req.user.admin, solicitationId);

        if (hasAccess === 404) {
            return res.status(404).json({ err: 'Solicitação não encontrada' });
        } else if (!hasAccess) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        app.db({ s: 'solicitations' })
            .where({ 's.id': solicitationId })
            .whereNull('closing_date')
            .join('categories', 'categories.id', '=', 's.category_id')
            .join('users', 'users.id', '=', 's.user_id')
            .select('s.id', 's.ticket', 's.subject', 's.description', 's.opening_date', 's.expected_date', 's.user_id')
            .select({ categoryName: 'categories.name' })
            .select({ userName: 'users.name' })
            .limit(1)
            .first()
            .then(data => {
                try {
                    existsOrError(data, 'Solicitação não encontrada');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err: 'Solicitação não encontrada' });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getByUserId = async (req, res) => {
        const userId = parseInt(req.params.id);

        if (userId !== req.user.id && !req.user.admin) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            knexFilter.user_id = userId;

            getWithFilter(knexFilter, page, res);
        } else {
            const result = await app.db('solicitations')
                .join('users', 'users.id', '=', 'solicitations.user_id')
                .where({ 'users.id': userId })
                .whereNull('closing_date')
                .count('solicitations.id')
                .first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
                .where({ 's.user_id': userId })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }

    const getByDepartmentId = async (req, res) => {
        const departmentId = parseInt(req.params.id);

        if (departmentId !== req.user.oper && !req.user.admin) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        const result = await app.db('solicitations')
            .join('categories', 'categories.id', '=', 'solicitations.category_id')
            .where({ 'categories.department_id': departmentId })
            .whereNull('closing_date')
            .count('solicitations.id')
            .first();
        const count = Object.values(result)[0];

        if (Object.entries(filter).length !== 0) {
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            knexFilter.department_id = departmentId;

            getWithFilter(knexFilter, page, count, res);
        } else {

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' })
                .select({ userName: 'users.name' })
                .where({ 'categories.department_id': departmentId })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }

    const getClosed = async (req, res) => {
        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            getClosedWithFilter(knexFilter, page, res);
        } else {
            const result = await app.db('solicitations').whereNotNull('closing_date').count('id').first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.closing_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
                .whereNotNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }
    const getClosedById = async (req, res) => {
        const solicitationId = req.params.id;

        const hasAccess = await checkAccess(req.user.id, req.user.department, req.user.admin, solicitationId);

        if (hasAccess === 404) {
            return res.status(404).json({ err: 'Solicitação não encontrada' });
        } else if (!hasAccess) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        app.db({ s: 'solicitations' })
            .where({ 's.id': solicitationId })
            .whereNotNull('closing_date')
            .join('categories', 'categories.id', '=', 's.category_id')
            .join({ o: 'users' }, 'o.id', '=', 's.operator_id')
            .join({ u: 'users' }, 'u.id', '=', 's.user_id')
            .select('s.id', 's.ticket', 's.subject', 's.description', 's.closing_text', 's.opening_date', 's.expected_date', 's.closing_date')
            .select({ categoryName: 'categories.name' })
            .select({ operatorName: 'o.name' })
            .select({ userName: 'u.name' })
            .limit(1)
            .first()
            .then(data => {
                try {
                    existsOrError(data, 'Solicitação não encontrada');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getClosedByUserId = async (req, res) => {
        const userId = parseInt(req.params.id);

        if (userId !== req.user.id && !req.user.admin) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            knexFilter.user_id = userId;

            getClosedWithFilter(knexFilter, page, res);
        } else {
            const result = await app.db('solicitations')
                .join('users', 'users.id', '=', 'solicitations.user_id')
                .where({ 'users.id': userId })
                .whereNotNull('closing_date')
                .count('solicitations.id')
                .first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.closing_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
                .where({ 's.user_id': userId })
                .whereNotNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }

    const getClosedByDepartmentId = async (req, res) => {
        const departmentId = parseInt(req.params.id);

        if (departmentId !== req.user.oper && !req.user.admin) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const page = req.query.page || 1

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];
                result[key] = item[1]
                return result;
            }, {})

            knexFilter.user_id = userId;

            getClosedWithFilter(knexFilter, page, res);
        } else {
            const result = await app.db('solicitations')
                .join('categories', 'categories.id', '=', 'solicitations.category_id')
                .where({ 'categories.department_id': departmentId })
                .whereNotNull('closing_date')
                .count('solicitations.id')
                .first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.closing_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })
                .where({ 'categories.department_id': departmentId })
                .whereNotNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }
    }

    const close = async (req, res) => {
        const solicitationId = req.params.id;        

        const hasAccess = await checkAccess(req.user.id, req.user.oper, req.user.admin, solicitationId);

        if (hasAccess === 404) {
            return res.status(404).json({ err: 'Solicitação não encontrada' });
        } else if (!hasAccess) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const solicitation = { 
            closing_text: req.body.closing_text || null,
            operator_id: req.user.id
        }
        solicitation.closing_date = moment().format('YYYY-MM-DD');      

        try {
            notExistsOrError(solicitation.id, 'Campo não permitido');
            notExistsOrError(solicitation.ticket, 'Campo não permitido');
            notExistsOrError(solicitation.subject, 'Campo não permitido');
            notExistsOrError(solicitation.description, 'Campo não permitido');
            notExistsOrError(solicitation.user_id, 'Campo não permitido');
            notExistsOrError(solicitation.category_id, 'Campo não permitido');
            existsOrError(solicitation.operator_id, 'Faltando código do Operador');
        } catch (err) {
            return res.status(400).json({ err });
        }


        app.db('solicitations')
            .where({ id: solicitationId })
            .whereNull('closing_date')
            .update(solicitation)
            .then(() => {
                emails.sendCloseMail(app.db, solicitationId);
                return res.status(200).send();                
            })                
            .catch(err => res.status(500).json(internalError(err)));
        
    }

    const remove = async (req, res) => {
        const solicitationId = req.params.id;

        const hasAccess = await checkAccess(req.user.id, req.user.department, req.user.admin, solicitationId);

        if (hasAccess === 404) {
            return res.status(404).json({ err: 'Solicitação não encontrada' });
        } else if (!hasAccess) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        app.db('solicitations')
            .where({ id: solicitationId })
            .del()
            .then(() => res.status(200).send())
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, update, get, getById, getByDepartmentId, getByUserId, getClosed, getClosedById, getClosedByUserId, getClosedByDepartmentId, close, remove };
}