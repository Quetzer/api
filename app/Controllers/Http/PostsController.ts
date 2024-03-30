import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema, rules } from '@ioc:Adonis/Core/Validator'
import Database from '@ioc:Adonis/Lucid/Database'
import APIException from 'App/Exceptions/APIException'
import Post from 'App/Models/Post'
import Application from '@ioc:Adonis/Core/Application'
import sharp from 'sharp'
import fs from 'fs/promises'
import Like from 'App/Models/Like'
import RssGenerator from 'App/Services/RssGenerator'

export default class PostsController {
  public async list({ request }: HttpContextContract) {
    const data = await request.validate({
      schema: schema.create({
        limit: schema.number.optional([rules.above(0)]),
        page: schema.number.optional([rules.above(0)]),
      }),
      messages: {
        'limit.number': "La limite d'articles doit être un nombre.",
        'limit.above': "La limite d'articles doit être supérieure à 0.",

        'page.number': 'Le numéro de page doit être un nombre.',
        'page.above': 'Le numéro de page doit être supérieur à 0.',
      },
    })

    let posts = Post.query()
      .orderBy('created_at', 'desc')
      .preload('author')
      .select([
        'id',
        'slug',
        'content',
        'created_at',
        'updated_at',
        'likes_count',
        'image',
        'author',
        'tags',
      ])

    if (data.limit && !data.page) {
      await posts.limit(data.limit)
    }

    if (data.limit && data.page) {
      await posts.offset(data.limit * data.page).limit(data.limit)
    }

    ;(await posts).map((post) => post.serializeAttributes({ omit: ['comments'] }))
    return await posts
  }

  public async get({ request, response, auth }: HttpContextContract) {
    const post = await Post.query()
      .preload('author')
      .preload('comments', (query) => query.limit(20))
      .preload('like')
      .where('id', '=', request.param('id'))
      .select([
        'id',
        'slug',
        'content',
        'tags',
        'created_at',
        'updated_at',
        'image',
        'author',
        'likes_count',
      ])
      .first()

    if (!post) {
      throw new APIException('Le post demandé est introuvable.', 404)
    }

    const user = auth.user

    let has_liked: boolean = false

    if (post && user) {
      const existingLike = await Like.query().where('user', user.id).where('post', post.id).first()

      if (existingLike) {
        has_liked = true
      }
    }

    response.header('has_liked', has_liked)

    const totalComments = await Database.from('comments').where('post', post.id).count('* as total')
    const commentCount = totalComments[0]?.total || 0

    response.header('nbComments', commentCount.toString())

    await post.save()

    return post
  }

  public async new({ request, response, auth }: HttpContextContract) {
    const postSchema = schema.create({
      content: schema.string({ trim: true }, [rules.minLength(200), rules.maxLength(10000)]),
      tags: schema.string({ trim: true }, [rules.minLength(1), rules.maxLength(15)]),
      image: schema.string({ trim: true }, [rules.minLength(3), rules.maxLength(100)]),
    })

    const data = await request.validate({
      schema: postSchema,
      messages: {
        'tags.required': 'Vous devez ajouter un tag à votre article.',
        'tags.minLength': 'Tag trop court',
        'tags.maxLength': 'Tag trop long',

        'content.required': 'Le contenu est requis.',
        'content.minLength': 'Le contenu doit faire au moins 200 caractères.',
        'content.maxLength': 'Le contenu doit faire au maximum 10000 caractères.',

        'image.required': 'Le lien vers votre image est requis !',
        'image.minLength': 'Le lien doit faire au moins 3 caractères.',
        'image.maxLength': 'Le lien doit faire maximum 100 caractères.',
      },
    })

    const post = new Post()
    post.tags = data.tags
    post.content = data.content
    post.image = data.image
    post.likes_count = 0
    await post.related('author').associate(auth.user!)
    await post.save()

    const allPosts = await Post.query().orderBy('created_at', 'desc').limit(10)

    const rssGenerator = new RssGenerator()
    const rssFeed = rssGenerator.generateRss(allPosts)

    await rssGenerator.saveRssToFile(rssFeed)

    return response.noContent()
  }

  public async update({ request, response }: HttpContextContract) {
    const post = await Post.findBy('id', request.param('id'))
    if (!post) throw new APIException('Le post demandé est introuvable.', 404)

    if (!post.hasPermission)
      throw new APIException("Vous n'avez pas la permission de modifier cet article.", 401)

    const { content, image, tags } = request.only(['title', 'content', 'image', 'tags'])

    await post.merge({ content, image, tags }).save()

    return response.noContent()
  }

  public async delete({ request, response }: HttpContextContract) {
    const post = await Post.findBy('id', request.param('id'))
    if (!post) throw new APIException('Le post demandé est introuvable.', 404)

    if (!post.hasPermission) throw new APIException("Vous n'êtes pas l'auteur de cet article.", 401)

    await post.delete()
    return response.noContent()
  }

  public async upload({ request, response }: HttpContextContract) {
    const image = request.file('image')

    if (!image) {
      throw new APIException("Il n'y a aucun fichier à télécharger", 404)
    }

    const fileName = image.clientName
    const resizedFileName = fileName
    const resizedImagePath = Application.publicPath() + '/posts/' + resizedFileName

    try {
      await image.move(Application.tmpPath(), {
        name: fileName,
        overwrite: true,
      })

      await sharp(Application.tmpPath() + '/' + fileName)
        .resize(104)
        .toFile(resizedImagePath)

      await fs.unlink(Application.tmpPath() + '/' + fileName)

      return response.ok({ path: resizedFileName })
    } catch (error) {
      throw new APIException("Erreur durant l'upload", 500)
    }
  }

  public async like({ auth, request }: HttpContextContract) {
    const post = await Post.findBy('id', request.param('id'))
    const user = auth.user

    if (post && user) {
      const existingLike = await Like.query().where('user', user.id).where('post', post.id).first()

      if (existingLike) {
        throw new APIException('Vous avez déjà liké ce post !', 401)
      }

      const like = new Like()
      await like.related('post').associate(post)
      await like.related('user').associate(auth.user!)
      await like.save()

      post.likes_count += 1
      await post.save()

      return post.likes_count
    }
  }

  public async unlike({ auth, request }: HttpContextContract) {
    const post = await Post.findBy('id', request.param('id'))
    const user = auth.user

    if (post && user) {
      const existingLike = await Like.query().where('user', user.id).where('post', post.id).first()

      if (!existingLike) {
        throw new APIException("Vous n'avez pas liké ce post !", 401)
      }

      await existingLike.delete()

      post.likes_count -= 1
      await post.save()

      return post.likes_count
    }
  }
}
