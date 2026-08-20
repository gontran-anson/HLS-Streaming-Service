import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const UploadFileController = () => import('#transcodes/controllers/upload_file_controller')
const IngestUrlController = () => import('#transcodes/controllers/ingest_url_controller')
const GetTranscodeStatusByIdController = () =>
  import('#transcodes/controllers/get_transcode_status_by_id_controller')
const DeleteTranscodeByIdController = () =>
  import('#transcodes/controllers/delete_transcode_by_id_controller')
const GetOpsPipelineController = () => import('#transcodes/controllers/get_ops_pipeline_controller')

// All routes are gated by delegated token verification (ADR-0003, jalon H):
// a valid bearer token is required; the service does not care who the caller is.
router
  .group(() => {
    router.post('/upload', [UploadFileController]).as('upload')
    router.post('/transcodes', [IngestUrlController]).as('transcodes.ingest')
    router.get('/transcodes/:id/status', [GetTranscodeStatusByIdController]).as('transcodes.status')
    router.delete('/transcodes/:id', [DeleteTranscodeByIdController]).as('transcodes.delete')
    router.get('/ops/pipeline', [GetOpsPipelineController]).as('ops.pipeline')
  })
  .use(middleware.auth())
