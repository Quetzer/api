import Route from '@ioc:Adonis/Core/Route'

Route.group(() => {
  Route.get('/', 'UsersController.list')
  Route.get(':id', 'UsersController.get')
  Route.get(':id/posts', 'UsersController.posts')
  Route.delete(':id', 'UsersController.delete')
  Route.put('/upgrade/:id', 'UsersController.upgrade')
  Route.group(() => {
    Route.post('/follow/:followerId/:followingId', 'FollowsController.follow')
    Route.delete('/unfollow/:followerId/:followingId', 'FollowsController.unfollow')
  }).middleware('auth')
}).prefix('/users')
