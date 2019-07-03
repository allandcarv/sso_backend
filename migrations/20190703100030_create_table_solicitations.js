
exports.up = function(knex) {
    return knex.schema.createTable('solicitations', function (table) {
        table.increments();
        table.string('subject').notNullable();
        table.string('description', 600).notNullable();
        table.date('opening_date').notNullable();
        table.date('expected_date');
        table.date('closing_date');
        table.integer('user_id').unsigned().notNullable();
        table.integer('operator_id').unsigned();
        table.integer('category_id').unsigned().notNullable();
        table.foreign('user_id').references('id').inTable('users');
        table.foreign('operator_id').references('id').inTable('users');
        table.foreign('category_id').references('id').inTable('categories');
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('solicitations');
};
