import router from '@adonisjs/core/services/router'
import '#common/routes'
import '#transcodes/routes'

router.get('/', async () => 'It works!')
