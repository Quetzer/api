import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/', 'PostsController.list')
  Route.get(':id', 'PostsController.get')

  Route.group(() => {
    Route.post('/', 'PostsController.new')
    Route.put(':id', 'PostsController.update')
    Route.delete(':id', 'PostsController.delete')
    Route.post('/upload', 'PostsController.upload')
    Route.post('/like/:id', 'PostsController.like')
    Route.delete('/unlike/:id', 'PostsController.unlike')

    Route.post(':id/comment', 'CommentsController.new')
  }).middleware('auth')
}).prefix('/posts')
