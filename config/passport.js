const passport = require('passport');
const passportJwt = require('passport-jwt');
const { Strategy, ExtractJwt } = passportJwt;
const { authSecret } = require('../.env');

module.exports = app => {
    const options = {
        secretOrKey: authSecret,
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
    }

    const strategy = new Strategy(options, (payload, done) => {
        app.db('users')
            .where({ id: payload.id})
            .whereNull('deleted_at')
            .then(user => done(null, user ? { ...payload } : false))
            .catch(err => done(err, false))
    });

    passport.use(strategy);

    return {
        authenticate: () => passport.authenticate('jwt', { session: false })
    }
}