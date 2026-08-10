import type { ApplicationService } from '@adonisjs/core/types'

export abstract class Scheduler {
  constructor(
    protected app: ApplicationService,
    protected minutes: number
  ) {
    let interval: NodeJS.Timeout | null = null

    app.ready(() => {
      interval = setInterval(() => this.execute(), minutes * 60 * 1000)
    })

    app.terminating(() => {
      if (interval) clearInterval(interval)
    })
  }

  abstract execute(): Promise<void>
}
