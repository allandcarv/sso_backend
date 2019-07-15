const moment = require('moment');

const nodemail = require('../config/nodemail');

module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const internalError = err => {
        return { userErr: 'Internal Server Error', err };
    };

    const checkAccess = async (admin, reqUserId, solicitationId) => {
        const isAdmin = admin;
        let isUser = false;
        let isOperator = false;

        if (!isAdmin) {
            let checkUser = await app.db('solicitations')
                .where({ id: solicitationId })
                .select('user_id', 'operator_id')
                .limit(1)
                .first()
                .catch(err => res.status(500).json(internalError(err)));
            isUser = Object.values(checkUser)[0] === reqUserId;

            if (!isUser && Object.values(checkUser)[1]) {
                isOperator = Object.values(checkUser)[1] === reqUserId;
            }
        }

        return (isUser || isOperator | isAdmin);
    }

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

        const operatorsMail = await app.db('users')
            .select('email')
            .join('departments', 'users.department_id', '=', 'departments.id')
            .join('categories', 'departments.id', '=', 'categories.department_id')
            .where({ 'categories.id': solicitation.category_id })
            .catch(err => res.status(500).json(internalError(err)))
            .toString();

        app.db('solicitations')
            .insert(solicitation)
            .then(data => {
                const subjectUser = `[ABERTURA DE SOLICITAÇÃO] Solicitação ${solicitation.ticket} criada com sucesso`;
                const bodyUser = `
                    <p>Olá ${req.user.name}.</p>
                    
                    <p>Este é um e-mail automático para indicar que a solicitação <strong>${solicitation.ticket}</strong>
                    foi criada com sucesso em nosso <a href="http://localhost/sso">Sistema de Solicitações Online</a>.</p>
                    
                    <p>Você receberá outra mensagem quando sua solicitação for atendida.</p>
                    
                    <p>Alterações nessa Solicitação podem ser feitas no link <a href="http://localhost/solicitacoes/${data}">
                    Solicitação de Nº ${solicitation.ticket}</a></p>
                    <br>
                    <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>                    
                    `;

                nodemail.sendmail(subjectUser, bodyUser, [req.user.email]);

                const subjectOper = `[ABERTURA ÁREA] Solicitação ${solicitation.ticket} criada para seu departamento`;
                const bodyOper = `
                    <p>Olá</p>
                    
                    <p>Uma nova Solicitação de Serviço foi criada para a sua área</p>
                    
                    <p>Por favor acesse <a href="http://localhost/solicitacoes/${data}">
                    Solicitação de Nº ${solicitation.ticket}</a> em nosso sistema para visualizar a solicitação.</p>
                    <br>
                    <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>
                    `;

                const receivers = operatorsMail.map(o => o.email);

                nodemail.sendmail(subjectOper, bodyOper, [receivers]);

                return res.status(200).send();
            })
            .catch(err => res.status(500).json({ err }));
    }

    const update = async (req, res) => {
        const id = req.params.id;
        
        if (!checkAccess(req.user.admin, req.user.id, id)) {
            return res.status(401).json({ err: 'Usuário sem permissão' });
        }
        
        const solicitation = { ...req.body };

        try {
            notExistsOrError(solicitation.id, 'Campo não permitido');
            notExistsOrError(solicitation.opening_date, 'Campo não permitido');
            notExistsOrError(solicitation.user_id, 'Campo não permitido');
            notExistsOrError(solicitation.category_id, 'Campo não permitido');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('solicitations')
            .where({ id })
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
    const get = async (req, res) => {
        
        const page = req.query.page || 1
        const result = await app.db('solicitations').whereNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            const key = Object.keys(filter).toString();
            const value = Object.values(filter).toString();

            app.db('solicitations')
                .join('categories', 'categories.id', '=', 'solicitations.category_id')
                .join('users', 'users.id', '=', 'solicitations.user_id')
                .leftJoin({ operators: 'users' }, 'users.id', '=', 'solicitations.operator_id')
                .select('solicitations.*')
                .select({ categoryName: 'categories.name', userName: 'users.name', operatorName: 'operators.name' })
                .whereNull('closing_date')
                .where(key, 'like', `%${value}%`)
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        } else {
            app.db('solicitations')
                .join('categories', 'categories.id', '=', 'solicitations.category_id')
                .join('users', 'users.id', '=', 'solicitations.user_id')
                .leftJoin({ operators: 'users' }, 'operators.id', '=', 'solicitations.operator_id')
                .select('solicitations.*')
                .select({ categoryName: 'categories.name', userName: 'users.name', operatorName: 'operators.name' })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        }        
    }

    const getById = async (req, res) => {
        const id = req.params.id;

        if (!await checkAccess(req.user.admin, req.user.id, id)) {
            return res.status(401).json({ err: 'Usuário sem permissão' });
        }

        app.db('solicitations')
            .where({ id })
            .whereNull('closing_date')
            .orderBy('id', 'desc')
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
        const id = req.params.id;
        const filter = { ...req.query };
        delete filter.page;

        if (!req.user.admin && id != req.user.id) return res.status(401).json({ err: 'Usuário sem permissão ' });

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id }).whereNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        if (Object.entries(filter).length !== 0) {
            const key = Object.keys(filter).toString();
            const value = Object.values(filter).toString();

            app.db('solicitations')
                .where({ user_id: id })
                .whereNull('closing_date')
                .where(key, 'like', `%${value}%`)
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        } else {
            app.db('solicitations')
                .where({ user_id: id })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)))
        }
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

        if(!checkAccess(req.user.admin, req.user.id, id)) {
            return res.status(401).json({ err: 'Usuário sem permissão.' });
        }

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id }).whereNotNull('closing_date').count('id').first();
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

        if (! await checkAccess(req.user.admin, req.user.id, id)) {
            return res.status(401).json({ err: 'Usuário sem permissão ' })
        }

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
        } catch (err) {
            return res.status(400).json({ err });
        }


        app.db('solicitations')
            .where({ id })
            .whereNull('closing_date')
            .update(solicitation)
            .then(data => {
                try {
                    existsOrError(data, 'Solicitação não encontrada');
                    return res.status(200).send();
                } catch (err) {
                    res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));

        const resultSolicitation = await app.db({ s: 'solicitations' })
            .join({ c: 'categories' }, 's.category_id', '=', 'c.id')
            .join({ d: 'departments ' }, 'c.department_id', '=', 'd.id')
            .join({ u: 'users' }, 's.user_id', '=', 'u.id')
            .join({ o: 'users' }, 'd.id', '=', 'o.department_id')
            .where({ 's.id': id })
            .whereNotNull('s.closing_date')
            .select({ userName: 'u.name' }, { userEmail: 'u.email' }, { operatorMail: 'o.email' }, { solicitationId: 's.id' }, 's.ticket')
            .catch(err => res.status(500).json(internalError(err)));

        const closingMail = {
            solicitationId: Object.values(resultSolicitation)[0].solicitationId,
            ticket: Object.values(resultSolicitation)[0].ticket,
            userName: Object.values(resultSolicitation)[0].userName,
            userEmail: Object.values(resultSolicitation)[0].userEmail,
            operatorsMail: {}
        }

        let operators = []
        for (i = 0; i < Object.values(resultSolicitation).length; i++) {
            operators.push(Object.values(resultSolicitation)[i].operatorMail);
        }
        closingMail.operatorsMail = operators;

        closingMail.subjectUser = `[ENCERRAMENTO DE SOLICITAÇÃO] Sua solicitação ${closingMail.ticket} foi encerrada`;
        closingMail.bodyUser = `
            <p>Olá ${closingMail.userName}.</p>
            
            <p>Este é um e-mail automático para indicar que a solicitação <strong>${closingMail.ticket}</strong>
            foi encerrada com sucesso em nosso <a href="http://localhost/sso">Sistema de Solicitações Online</a>.</p>
                                    
            <p>Você pode acessar o link <a href="http://localhost/solicitacoes/${closingMail.solicitationId}">Solicitação de Nº ${closingMail.ticket}</a>
            para obter maiores informações</p>
            <br>
            <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>                    
            `;

        nodemail.sendmail(closingMail.subjectUser, closingMail.bodyUser, [closingMail.userEmail]);

        closingMail.subjectOper = `[ENCERRAMENTO ÁREA] Solicitação ${closingMail.ticket} foi encerrada`;
        closingMail.bodyOper = `
            <p>Olá</p>
            
            <p>A solicitação <strong>${closingMail.ticket}</strong> que estava vinculada à sua área foi encerrada</p>
            
            <p>Acesse <a href="http://localhost/solicitacoes/${closingMail.solicitationId}">
            Solicitação de Nº ${closingMail.ticket}</a> para maiores informações.</p>
            <br>
            <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>
            `;

        nodemail.sendmail(closingMail.subjectOper, closingMail.bodyOper, closingMail.operatorsMail);
    }

    const remove = async (req, res) => {
        const id = req.params.id;

        if (!checkAccess(req.user.admin, req.user.id, id)) {
            return res.status(401).json({ err: 'Usuário não autorizado' });
        }

        app.db('solicitations')
            .where({ id })
            .del()
            .then(data => {
                try {
                    existsOrError(data, 'Solicitação não encontrada');
                } catch (err) {
                    return res.status(404).json({ err });
                }

                return res.status(200).send();
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, update, get, getById, getByUserId, getClosed, getClosedByUserId, close, remove };
}