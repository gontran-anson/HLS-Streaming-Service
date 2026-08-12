import router from '@adonisjs/core/services/router'

// Auth (a token verified against a configured endpoint) lands in jalon H (#8);
// these routes are open for now.
const UploadFileController = () => import('#transcodes/controllers/upload_file_controller')
const GetTranscodeStatusByIdController = () =>
  import('#transcodes/controllers/get_transcode_status_by_id_controller')

router.post('/upload', [UploadFileController]).as('upload')
router.get('/transcodes/:id/status', [GetTranscodeStatusByIdController]).as('transcodes.status')
