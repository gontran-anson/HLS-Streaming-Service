export abstract class FetchRepositoryContract<M, C> {
  abstract find(criteria: C): Promise<M[]>
  abstract findOne(criteria: C): Promise<M | null>
}
