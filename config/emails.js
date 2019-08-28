const nodemail = require('./nodemail');

const sendOpenMail = async (db, solicitation) => {
    const operatorsMail = await db('users')
        .select('email')
        .join('departments', 'users.department_id', '=', 'departments.id')
        .join('categories', 'departments.id', '=', 'categories.department_id')
        .where({ 'categories.id': solicitation.category_id })
        .catch(err => res.status(500).json(internalError(err)));

    const subjectUser = `[ABERTURA DE SOLICITAÇÃO] Solicitação ${solicitation.ticket} criada com sucesso`;
    const bodyUser = `
                <p>Olá ${solicitation.user}.</p>
                
                <p>Este é um e-mail automático para indicar que a solicitação <strong>${solicitation.ticket}</strong>
                foi criada com sucesso em nosso <a href="http://localhost/sso">Sistema de Solicitações Online</a>.</p>
                
                <p>Você receberá outra mensagem quando sua solicitação for atendida.</p>
                
                <p>Alterações nessa Solicitação podem ser feitas no link <a href="http://localhost/solicitacoes/${solicitation.id}">
                Solicitação de Nº ${solicitation.ticket}</a></p>
                <br>
                <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>                    
                `;

    nodemail.sendmail(subjectUser, bodyUser, [solicitation.user_email]);

    const subjectOper = `[ABERTURA ÁREA] Solicitação ${solicitation.ticket} criada para seu departamento`;
    const bodyOper = `
                <p>Olá</p>
                
                <p>Uma nova Solicitação de Serviço foi criada para a sua área</p>
                
                <p>Por favor acesse <a href="http://localhost/solicitacoes/${solicitation.id}">
                Solicitação de Nº ${solicitation.ticket}</a> em nosso sistema para visualizar a solicitação.</p>
                <br>
                <small><a href="http://localhost/sso">SSO-CEB</a>. Desenvolvido pelo <a href="mailto:redes@ceb.unicamp.br">Departamento de Informática - CEB</a></small>
                `;

    const receivers = operatorsMail.map(o => o.email);

    nodemail.sendmail(subjectOper, bodyOper, [receivers]);
}

const sendCloseMail = async (db, solicitationId) => {
    const resultSolicitation = await db({ s: 'solicitations' })
        .join({ c: 'categories' }, 's.category_id', '=', 'c.id')
        .join({ d: 'departments ' }, 'c.department_id', '=', 'd.id')
        .join({ u: 'users' }, 's.user_id', '=', 'u.id')
        .join({ o: 'users' }, 'd.id', '=', 'o.department_id')
        .where({ 's.id': solicitationId })
        .whereNotNull('s.closing_date')
        .select({ userName: 'u.name' }, { userEmail: 'u.email' }, { operatorMail: 'o.email' }, { solId: 's.id' }, 's.ticket')
        .catch(err => res.status(500).json(internalError(err)));

    const closingMail = {
        solicitationId: Object.values(resultSolicitation)[0].solId,
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

module.exports = { sendOpenMail, sendCloseMail };