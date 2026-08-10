import type { PaginationDto } from '#common/data/pagination_dto'
import type { HttpRequest } from '@adonisjs/core/http'

export class PaginationService {
  paginate(data: any[], total: number, limit: number, page: number): PaginationDto {
    return {
      data,
      meta: {
        total,
        page,
        perPage: limit,
        currentPage: Math.ceil(page),
        lastPage: Math.ceil(total / limit),
        firstPage: 1,
        lastPageUrl: `/?page=${Math.ceil(total / limit)}`,
        firstPageUrl: '/?page=1',
        nextPageUrl: `/?page=${page + 1}`,
        previousPageUrl: `/?page=${page - 1}`,
      },
    }
  }

  getPaginationOption(request: HttpRequest) {
    return {
      limit: Math.abs(request.qs().limit ?? 20),
      page: Math.abs(request.qs().page ?? 1),
    }
  }
}
