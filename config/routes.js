module.exports = app => {
    app.route('/users')
        .get((req, res) => {
            res.send('Hello World!!')
        })
}