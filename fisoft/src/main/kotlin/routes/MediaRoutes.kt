package com.ilyasdemirkiran.routes

import com.ilyasdemirkiran.repository.CustomerRepository
import com.ilyasdemirkiran.repository.MediaRepository
import com.ilyasdemirkiran.repository.UserRepository
import com.ilyasdemirkiran.services.MinioStorageService
import com.ilyasdemirkiran.types.media.ImageTag
import com.ilyasdemirkiran.types.media.Photo
import com.ilyasdemirkiran.types.request.CreateTagRequest
import com.ilyasdemirkiran.types.request.UpdatePhotoRequest
import com.ilyasdemirkiran.types.request.UpdateTagRequest
import com.ilyasdemirkiran.types.response.ServerResponse
import com.ilyasdemirkiran.utils.toUuid
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.InputStream
import kotlin.uuid.Uuid

fun Route.mediaRoutes(
  mediaRepository: MediaRepository,
  userRepository: UserRepository,
  customerRepository: CustomerRepository = CustomerRepository(),
  storageService: MinioStorageService = MinioStorageService()
) {

  // --- TAG / LABEL ROUTES ---
  route("/tags") {

    // GET /tags - List all tags for company
    get {
      call.authenticate<List<ImageTag>>(requireCompany = true, userRepository = userRepository) { auth ->
        val tags = mediaRepository.getTagsByCompanyId(auth.user.companyId!!)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = tags))
      }
    }

    // POST /tags - Create tag
    post {
      call.authenticate<ImageTag>(requireCompany = true, userRepository = userRepository) { auth ->
        val request = call.receive<CreateTagRequest>()
        val tag = mediaRepository.createTag(auth.user.companyId!!, request.name)
        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Tag created successfully", data = tag))
      }
    }

    // PUT /tags/{id} - Update tag
    put("/{id}") {
      call.authenticate<ImageTag>(requireCompany = true, userRepository = userRepository) { auth ->
        val tagId = (call.parameters["id"] ?: throw IllegalArgumentException("Tag ID is required")).toUuid()
        val request = call.receive<UpdateTagRequest>()
        val updated = mediaRepository.updateTag(tagId, auth.user.companyId!!, request.name)

        if (updated == null) {
          call.respond(HttpStatusCode.NotFound, ServerResponse<ImageTag>(false, "Tag not found"))
        } else {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Tag updated successfully", data = updated))
        }
      }
    }

    // DELETE /tags/{id} - Delete tag (Removes tag from all photos)
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val tagId = (call.parameters["id"] ?: throw IllegalArgumentException("Tag ID is required")).toUuid()
        val deleted = mediaRepository.deleteTag(tagId, auth.user.companyId!!)

        if (deleted) {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Tag deleted and removed from all photos"))
        } else {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Tag not found"))
        }
      }
    }
  }

  // --- PHOTO / GALLERY ROUTES ---
  route("/photos") {

    // GET /photos - List photos (Optional ?customerId=... & ?tagId=...)
    get {
      call.authenticate<List<Photo>>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val customerIdParam = call.request.queryParameters["customerId"]?.toUuid()
        val tagIdParam = call.request.queryParameters["tagId"]?.toUuid()

        val photos = mediaRepository.getPhotosByCompany(companyId, customerIdParam, tagIdParam)
        call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = photos))
      }
    }

    // POST /photos/upload - Multipart upload photo to MinIO & Database
    post("/upload") {
      call.authenticate<Photo>(requireCompany = true, userRepository = userRepository) { auth ->
        val companyId = auth.user.companyId!!
        val multipart = call.receiveMultipart()

        var title: String? = null
        var description: String = ""
        var customerId: Uuid? = null
        val tagIds = mutableListOf<Uuid>()

        var bytes: ByteArray? = null
        var filename: String? = null
        var contentType: String = "image/jpeg"

        multipart.forEachPart { part ->
          when (part) {
            is PartData.FormItem -> {
              when (part.name) {
                "title" -> title = part.value
                "description" -> description = part.value
                "customerId" -> customerId = if (part.value.isNotBlank()) part.value.toUuid() else null
                "tagIds" -> {
                  part.value.split(",")
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .forEach { tagIds.add(it.toUuid()) }
                }
              }
            }
            is PartData.FileItem -> {
              filename = part.originalFileName ?: "photo.jpg"
              contentType = part.contentType?.toString() ?: "image/jpeg"
              bytes = part.streamProvider().readBytes()
            }
            else -> {}
          }
          part.dispose()
        }

        if (filename.isNullOrEmpty() || bytes == null || bytes!!.isEmpty()) {
          return@authenticate call.respond(HttpStatusCode.BadRequest, ServerResponse<Photo>(false, "Image file is required"))
        }

        val photoTitle = title ?: filename ?: "Untitled Photo"
        val photoBytes = bytes!!
        val fileSize = photoBytes.size.toLong()

        // MinIO Upload
        val (objectName, publicUrl) = storageService.uploadFile(
          bytes = photoBytes,
          filename = filename!!,
          contentType = contentType,
          companyId = companyId
        )

        // Customer imageCount güncelleme (müşteri görseli ise)
        if (customerId != null) {
          val customer = customerRepository.getById(customerId!!, companyId)
          if (customer == null) {
            storageService.deleteFile(objectName)
            return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Photo>(false, "Customer not found"))
          }
        }

        val photo = mediaRepository.createPhoto(
          companyId = companyId,
          uploaderId = auth.user.id,
          title = photoTitle,
          url = publicUrl,
          filename = objectName,
          customerId = customerId,
          description = description,
          mimeType = contentType,
          size = fileSize,
          tagIds = tagIds
        )

        call.respond(HttpStatusCode.Created, ServerResponse(success = true, message = "Photo uploaded successfully", data = photo))
      }
    }

    // GET /photos/{id} - Get photo detail
    get("/{id}") {
      call.authenticate<Photo>(requireCompany = true, userRepository = userRepository) { auth ->
        val photoId = (call.parameters["id"] ?: throw IllegalArgumentException("Photo ID is required")).toUuid()
        val photo = mediaRepository.getPhotoById(photoId, auth.user.companyId!!)

        if (photo == null) {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Photo>(false, "Photo not found"))
        } else {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = photo))
        }
      }
    }

    // PUT /photos/{id} - Update photo metadata & tags
    put("/{id}") {
      call.authenticate<Photo>(requireCompany = true, userRepository = userRepository) { auth ->
        val photoId = (call.parameters["id"] ?: throw IllegalArgumentException("Photo ID is required")).toUuid()
        val request = call.receive<UpdatePhotoRequest>()

        val customerUuid = request.customerId?.let { if (it.isNotBlank()) it.toUuid() else null }
        val tagUuids = request.tagIds?.filter { it.isNotBlank() }?.map { it.toUuid() }

        val updated = mediaRepository.updatePhoto(
          photoId = photoId,
          companyId = auth.user.companyId!!,
          title = request.title,
          description = request.description,
          customerId = customerUuid,
          tagIds = tagUuids
        )

        if (updated == null) {
          call.respond(HttpStatusCode.NotFound, ServerResponse<Photo>(false, "Photo not found"))
        } else {
          call.respond(HttpStatusCode.OK, ServerResponse(success = true, message = "Photo updated successfully", data = updated))
        }
      }
    }

    // DELETE /photos/{id} - Delete photo
    delete("/{id}") {
      call.authenticate<Map<String, Boolean>>(requireCompany = true, userRepository = userRepository) { auth ->
        val photoId = (call.parameters["id"] ?: throw IllegalArgumentException("Photo ID is required")).toUuid()
        val companyId = auth.user.companyId!!

        val photo = mediaRepository.getPhotoById(photoId, companyId)
          ?: return@authenticate call.respond(HttpStatusCode.NotFound, ServerResponse<Map<String, Boolean>>(false, "Photo not found"))

        // MinIO & Database'den sil
        storageService.deleteFile(photo.filename)
        mediaRepository.deletePhoto(photoId, companyId)

        call.respond(HttpStatusCode.OK, ServerResponse(success = true, data = mapOf("success" to true), message = "Photo deleted successfully"))
      }
    }
  }
}
