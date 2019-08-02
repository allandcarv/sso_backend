const moment = require('moment');

const nodemail = require('../config/nodemail');

module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const internalError = msg => {
        return { err: 'Essa não, erro no servidor!!! :(', devMsg: msg };
    };

    const checkAccess = async (reqUserAdmin = null, reqUserOperator = null, reqUserId, solicitationId) => {
        const isAdmin = reqUserAdmin;
        let isUser = false;
        let isOperator = false;

        if (!isAdmin) {
            let checkUser = await app.db({ s: 'solicitations' })
                .where({ id: solicitationId })
                .join('categories', 's.category_id', '=', 'categories.id' )
                .select('s.user_id', 'categories.department_id')
                .limit(1)
                .first()                
            isUser = Object.values(checkUser)[0] === reqUserId;
            isOperator = Object.values(checkUser)[1] === reqUserOperator;
            
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
            .catch(err => res.status(500).json( err ));
    }

    const update = async (req, res) => {                
        const solicitation = { ...req.body };
        solicitation.id = req.params.id;
        
        if (req.user.id !== solicitation.user_id) {
            return res.status(401).json({ err: 'Usuário não autorizado' });
        }

        try {            
            notExistsOrError(solicitation.opening_date, 'Campo não permitido');            
            notExistsOrError(solicitation.category_id, 'Campo não permitido');
        } catch (err) {
            return res.status(400).json({ err });
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
    const get = async (req, res) => {
        
        const page = req.query.page || 1
        
        const filter = { ...req.query };
        delete filter.page;

        if (Object.entries(filter).length !== 0) {
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];                
                result[key] = item[1]
                return result;
            }, {})
            
            const knexBuilder = builder => {
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
            
            const result = await app.db('solicitations').whereNull('closing_date').where(knexBuilder).count('id').first();
            const count = Object.values(result)[0];

            app.db({ s: 'solicitations' })
                .join('categories', 'categories.id', '=', 's.category_id')
                .join('users', 'users.id', '=', 's.user_id')                
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', 's.user_id', 's.category_id')
                .select({ categoryName: 'categories.name' }, { userName: 'users.name' })                
                .whereNull('closing_date')
                .where(knexBuilder)
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
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
        const id = req.params.id;        

        app.db({ s: 'solicitations' })
            .where({ 's.id': id })
            .whereNull('closing_date')
            .join('categories', 'categories.id', '=', 's.category_id')
            .join('users', 'users.id', '=', 's.user_id')
            .select('s.id', 's.ticket', 's.subject', 's.description', 's.opening_date', 's.expected_date')
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
        const id = req.user.id;
        const filter = { ...req.query };
        delete filter.page;        

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id }).whereNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        if (Object.entries(filter).length !== 0) {            
            const knexFilter = Object.entries(filter).reduce((result, item) => {
                const key = item[0];                
                result[key] = item[1]
                return result;
            }, {})
            
            app.db({ s: 'solicitations' })
                .where({ user_id: id })                
                .where('ticket', 'like', `%${knexFilter.ticket || ''}%`)
                .whereNull('closing_date')
                .join('categories', 'categories.id', '=', 's.category_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', { categoryName: 'categories.name' })
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
        } else {
            app.db({ s: 'solicitations' })
                .where({ user_id: id })
                .join('categories', 'categories.id', '=', 's.category_id')
                .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.expected_date', { categoryName: 'categories.name' })
                .whereNull('closing_date')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id', 'desc')
                .then(data => res.status(200).json({ data, page, count, limit }))
                .catch(err => res.status(500).json(internalError(err)));
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

    const getClosedById = async (req, res) => {
        const id = req.params.id;
        
        app.db({ s: 'solicitations' })
            .where({ 's.id': id })
            .whereNotNull('closing_date')
            .join('categories', 'categories.id', '=', 's.category_id')
            .join('users', 'users.id', '=', 's.operator_id')
            .select('s.id', 's.ticket', 's.subject', 's.description', 's.opening_date', 's.expected_date', 's.closing_date', 's.closing_text')
            .select({ categoryName: 'categories.name' }, { operatorName: 'users.name' })
            .limit(1)
            .first()
            .then(data => {
                console.log(data);
                try {
                    existsOrError(data, 'Solicitação não encontrada');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err: 'Solicitação não encontrada' });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getClosedByUserId = async (req, res) => {
        const id = req.user.id;        

        const page = req.query.page || 1;
        const result = await app.db('solicitations').where({ user_id: id }).whereNotNull('closing_date').count('id').first();
        const count = Object.values(result)[0];

        app.db({ s: 'solicitations' })
            .where({ user_id: id })
            .whereNotNull('closing_date')
            .join('categories', 'categories.id', '=', 's.category_id')            
            .select('s.id', 's.ticket', 's.subject', 's.opening_date', 's.closing_date', { categoryName: 'categories.name'})
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

    return { save, update, get, getById, getByUserId, getClosed, getClosedById, getClosedByUserId, close, remove };
}