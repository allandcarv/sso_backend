const nodemailer = require('nodemailer');

const sendmail = async (subject, body, receivers) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
            user: 'delaney2@ethereal.email',
            pass: 'bV7NVaGSsNP29g5cPA'
        }
    });

    const info = await transporter.sendMail({
        from: '"Sistema de Solicitações Online - CEB" <sso@ceb.unicamp.br',
        to: [...receivers],
        subject,
        html: body
    });

    console.log(info);

}

module.exports = { sendmail };