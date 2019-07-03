
exports.up = function(knex) {
  return knex.schema.createTable('departments', function (table) {
      table.increments();
      table.string('name').notNullable();
      table.string('initials', 3).notNullable();
      table.unique(['name', 'initials']);
  })
};

exports.down = function(knex) {
  return knex.schema.dropTable('departments');
};
