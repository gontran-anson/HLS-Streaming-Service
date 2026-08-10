import router from '@adonisjs/core/services/router'

const EchoController = () => import('#common/controllers/echo_controller')
const PinController = () => import('#common/controllers/ping_controller')

router.group(() => {
  router.get('/ping', [PinController]).as('ping.get')
  router.post('/ping', [PinController]).as('ping.post')
  router.post('/echo', [EchoController]).as('echo')
})
