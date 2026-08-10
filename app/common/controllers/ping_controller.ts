import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class PingController {
  /**
   * @handle
   * @summary
   * @operationId
   * @description
   */
  async handle({ response }: HttpContext) {
    return response.ok({ message: 'pong' })
  }
}
