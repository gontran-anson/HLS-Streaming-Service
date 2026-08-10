export abstract class CreateUpdateRepositoryContract<MODEL, IDTYPE, CR, UP> {
  abstract create(payload: CR): Promise<MODEL>
  abstract update(id: IDTYPE, payload: UP): Promise<MODEL>
}
