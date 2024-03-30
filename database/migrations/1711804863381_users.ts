import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('username', 12).notNullable().unique()
      table.string('email', 255).notNullable().unique()
      table.integer('permission').defaultTo(0).notNullable()
      table.string('password', 180).notNullable()
      table.string('avatar')
      table.string('biography', 300)
      table.integer('followers')
      table.string('remember_me_token').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
