import { DateTime } from 'luxon'
import Hash from '@ioc:Adonis/Core/Hash'
import { column, beforeSave, BaseModel, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Permissions from 'Contracts/Enums/Permissions'
import Follow from './Follow'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public username: string

  @column()
  public avatar: string | null

  @column()
  public email: string

  @column({ serializeAs: null })
  public password: string

  @column()
  public biography: string | null

  @column()
  public permission: Permissions

  @column({ serializeAs: null })
  public rememberMeToken: string | null

  @column.dateTime()
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @column()
  @hasMany(() => Follow, {
    foreignKey: 'followerId',
  })
  public following: HasMany<typeof Follow>

  @column()
  @hasMany(() => Follow, {
    foreignKey: 'followingId',
  })
  public followersCount: HasMany<typeof Follow>

  @column()
  public followers: number

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }
  }
}
