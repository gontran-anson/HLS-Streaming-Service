export abstract class PresenterContract<M> {
  abstract toJson(model: M): any
  abstract toJsonList(models: M[]): any
}
