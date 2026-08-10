import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class EchoController {
  /**
   * @handle
   * @summary
   * @operationId
   * @description
   */
  async handle({ request, response }: HttpContext) {
    return response.json(request.all())
  }
}
