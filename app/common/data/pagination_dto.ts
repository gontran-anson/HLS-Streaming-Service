export type PaginationDto = {
  data: any[]
  meta: {
    total: number
    page: number
    perPage: number
    currentPage: number
    lastPage: number
    firstPage: number
    lastPageUrl: string
    firstPageUrl: string
    nextPageUrl: string
    previousPageUrl: string

    // "lastPageUrl": "/?page=10",
    // "firstPageUrl": "/?page=1",
    // "nextPageUrl": "/?page=6",
    // "previousPageUrl": "/?page=5"
  }
}
