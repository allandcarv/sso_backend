const moment = require('moment');

module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const internalError = err => {
       return { userErr: 'Internal Server Error', err };
    };  

    const save = async (req, res) => {
        const solicitation = { ...req.body };

        try {
            existsOrError(solicitation.subject, 'Faltando o assunto da solicitação');
            existsOrError(solicitation.description, 'Faltando a descrição da solicitação');
            existsOrError(solicitation.user_id, 'Faltando a identificação do usuário');
            existsOrError(solicitation.category_id, 'Faltando a categoria da solicitação');
            notExistsOrError(solicitation.id, 'Campo não permitido');            
            notExistsOrError(solicitation.ticket, 'Campo não permitido');
            notExistsOrError(solicitation.opening_date, 'Campo não permitido');
            notExistsOrError(solicitation.closing_date, 'Campo não permitido');

            const checkUserId = await app.db('users').where({ id: solicitation.user_id }).whereNull('deleted_at').select('id').limit(1).first();
            existsOrError(checkUserId, 'Usuário não encontrado');

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

        if (!solicitation.opening_date) {
            solicitation.opening_date = moment().format('YYYY-MM-DD');
        }

        app.db('solicitations')
            .insert(solicitation)
            .then(() => res.status(201).send())
            .catch(err => res.status(500).json(internalError(err)));
    }

    const update = async (req, res) => {
        const solicitation = { ...req.body };
        const id = req.params.id;
        
        try {
            notExistsOrError(solicitation.id, 'Campo não permitido');
            notExistsOrError(solicitation.opening_date, 'Campo não permitido');
            notExistsOrError(solicitation.user_id, 'Campo não permitido');
            notExistsOrError(solicitation.category_id, 'Campo não permitido');
            
            const checkSolicitationId = await app.db('solicitations').where({ id }).whereNull('closing_date').select('id').limit(1).first();            
            existsOrError(checkSolicitationId, 'Solicitação não encontrada');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('solicitations')
            .where({ id: req.params.id })
            .whereNull('closing_date')
            .update(solicitation)
            .then(() => res.status(200).send())
            .catch(err => res.status(500).json(internalError(err)));
    }

    const limit = 10;
    const get = async (req, res) => {        
        const page = req.query.page || 1
        const result = await app.db('solicitations').whereNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        app.db('solicitations')
            .whereNull('closing_date')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));        
    }

    const getById = (req, res) => {
        const id = req.params.id;                

        app.db('solicitations')
            .where({ id })
            .whereNull('closing_date')            
            .orderBy('id', 'desc')
            .first()
            .then(data => res.status(200).json(data))
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getByUserId = async (req, res) => {
        const id = req.params.id;

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id }).whereNull('closing_date').count('id').first();
        const count = Object.values(result)[0];        

        app.db('solicitations')
            .where({ user_id: id})
            .whereNull('closing_date')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)))
    }

    const getClosed = async (req, res) => {
        const page = req.query.page || 1;
        const result = await app.db('solicitations').whereNotNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        app.db('solicitations')
            .whereNotNull('closing_date')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getClosedByUserId = async (req, res) => {
        const id = req.params.id;

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id}).whereNotNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        app.db('solicitations')
            .where({ user_id: id })
            .whereNotNull('closing_date')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id', 'desc')
            .then(data => res.status(200).json({ data, page, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));
    }

    const close = async (req, res) => {
        const id = req.params.id;
        const solicitation = { ...req.body }
        solicitation.closing_date = moment().format('YYYY-MM-DD')

        try {
            notExistsOrError(solicitation.id, 'Campo não permitido');
            notExistsOrError(solicitation.ticket, 'Campo não permitido');
            notExistsOrError(solicitation.subject, 'Campo não permitido');
            notExistsOrError(solicitation.description, 'Campo não permitido');
            notExistsOrError(solicitation.user_id, 'Campo não permitido');
            notExistsOrError(solicitation.category_id, 'Campo não permitido');
            existsOrError(solicitation.operator_id, 'Faltando código do Operador');

            const checkSolicitationId = await app.db('solicitations').where({ id }).whereNull('closing_date').select('id').limit(1).first();
            existsOrError(checkSolicitationId, 'Solicitação não encontrada');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('solicitations')
            .where({ id })
            .whereNull('closing_date')
            .update(solicitation)
            .then(() => res.status(200).send())
            .catch(err => res.status(500).json(internalError(err)));
    }

    const remove = async (req, res) => {
        const id = req.params.id;

        try {
            const checkSolicitationId = await app.db('solicitations').where({ id }).select('id').limit(1).first();
            existsOrError(checkSolicitationId, 'Solicitação não encontrada');
        } catch (err) {
            return res.status(404).json({ err });
        }

        app.db('solicitations')
            .where({ id })
            .del()
            .then(() => res.status(200).send())
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, update, get, getById, getByUserId, getClosed, getClosedByUserId , close, remove };
}