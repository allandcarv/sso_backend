const admin = require('./admin');

module.exports = app => {
    app.post('/signin', app.api.auth.signin);

    app.route('/departments')
        .all(app.config.passport.authenticate())
        .get(app.api.departments.get)
        .post(admin(app.api.departments.save));

    app.route('/departments/:id')
        .all(app.config.passport.authenticate())
        .get(app.api.departments.get)
        .put(admin(app.api.departments.save))
        .delete(admin(app.api.departments.remove));

    app.route('/categories')
        .all(app.config.passport.authenticate())
        .get(app.api.categories.get)
        .post(admin(app.api.categories.save));

    app.route('/categories/:id')
        .all(app.config.passport.authenticate())
        .get(app.api.categories.getByCategoryId)
        .put(admin(app.api.categories.update))
        .delete(admin(app.api.categories.remove));

    app.route('/users')
        .all(app.config.passport.authenticate())
        .get(admin(app.api.users.get))
        .post(admin(app.api.users.save));

    app.route('/users/:id')
        .all(app.config.passport.authenticate())
        .get(app.api.users.getByUserId)
        .put(app.api.users.update)
        .delete(admin(app.api.users.remove));

    app.route('/solicitations')
        .all(app.config.passport.authenticate())
        .get(admin(app.api.solicitations.get))
        .post(app.api.solicitations.save)

    app.route('/solicitations/user/:id/closed')
        .all(app.config.passport.authenticate())
        .get(app.api.solicitations.getClosedByUserId);

    app.route('/solicitations/user/:id')
        .all(app.config.passport.authenticate())
        .get(app.api.solicitations.getByUserId);

    app.route('/solicitations/closed')
        .all(app.config.passport.authenticate())
        .get(admin(app.api.solicitations.getClosed));

    app.route('/solicitations/:id/close')
        .all(app.config.passport.authenticate())
        .put(app.api.solicitations.close);
    
    app.route('/solicitations/:id')
        .all(app.config.passport.authenticate())
        .get(app.api.solicitations.getById)
        .put(app.api.solicitations.update)
        .delete(app.api.solicitations.remove)
}