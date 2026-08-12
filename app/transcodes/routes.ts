import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const UploadFileController = () => import('#transcodes/controllers/upload_file_controller')
const GetTranscodeStatusByIdController = () =>
  import('#transcodes/controllers/get_transcode_status_by_id_controller')

// Both routes are gated by delegated token verification (ADR-0003, jalon H):
// a valid bearer token is required; the service does not care who the caller is.
router
  .group(() => {
    router.post('/upload', [UploadFileController]).as('upload')
    router.get('/transcodes/:id/status', [GetTranscodeStatusByIdController]).as('transcodes.status')
  })
  .use(middleware.auth())
