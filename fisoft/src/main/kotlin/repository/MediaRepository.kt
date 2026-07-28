package com.ilyasdemirkiran.repository

import com.ilyasdemirkiran.types.media.*
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import kotlin.uuid.Uuid

class MediaRepository {

  // --- IMAGE TAG (LABEL) CRUD ---

  fun createTag(companyId: Uuid, name: String): ImageTag = transaction {
    val id = Uuid.random()
    val createdAt = Instant.now()

    ImageTagsTable.insert {
      it[ImageTagsTable.id] = id
      it[ImageTagsTable.companyId] = companyId
      it[ImageTagsTable.name] = name
      it[ImageTagsTable.createdAt] = createdAt
    }

    ImageTag(id = id, companyId = companyId, name = name, createdAt = createdAt)
  }

  fun getTagsByCompanyId(companyId: Uuid): List<ImageTag> = transaction {
    ImageTagsTable.selectAll()
      .where { ImageTagsTable.companyId eq companyId }
      .map { it.toImageTag() }
  }

  fun getTagById(id: Uuid, companyId: Uuid): ImageTag? = transaction {
    ImageTagsTable.selectAll()
      .where { (ImageTagsTable.id eq id) and (ImageTagsTable.companyId eq companyId) }
      .map { it.toImageTag() }
      .firstOrNull()
  }

  fun updateTag(id: Uuid, companyId: Uuid, name: String): ImageTag? = transaction {
    ImageTagsTable.update({ (ImageTagsTable.id eq id) and (ImageTagsTable.companyId eq companyId) }) { update ->
      update[ImageTagsTable.name] = name
    }
    getTagById(id, companyId)
  }

  /**
   * Tag silindiğinde Many-to-Many junction tablosundan (PhotoTagsTable) ve tüm fotoğraflardan o etiket otomatik kaldırılır
   */
  fun deleteTag(id: Uuid, companyId: Uuid): Boolean = transaction {
    val tag = getTagById(id, companyId) ?: return@transaction false
    // Junction tablosundan bağlantıları sil
    PhotoTagsTable.deleteWhere { PhotoTagsTable.tagId eq tag.id }
    // Ana tag'i sil
    ImageTagsTable.deleteWhere { ImageTagsTable.id eq tag.id } > 0
  }

  // --- PHOTO CRUD & TAGGING ---

  fun createPhoto(
    companyId: Uuid,
    uploaderId: Uuid,
    title: String,
    url: String,
    filename: String,
    customerId: Uuid? = null,
    description: String = "",
    mimeType: String = "image/jpeg",
    size: Long = 0L,
    tagIds: List<Uuid> = emptyList()
  ): Photo = transaction {
    val photoId = Uuid.random()
    val createdAt = Instant.now()

    PhotosTable.insert {
      it[PhotosTable.id] = photoId
      it[PhotosTable.companyId] = companyId
      it[PhotosTable.customerId] = customerId
      it[PhotosTable.uploaderId] = uploaderId
      it[PhotosTable.title] = title
      it[PhotosTable.description] = description
      it[PhotosTable.url] = url
      it[PhotosTable.filename] = filename
      it[PhotosTable.mimeType] = mimeType
      it[PhotosTable.size] = size
      it[PhotosTable.createdAt] = createdAt
    }

    if (tagIds.isNotEmpty()) {
      tagIds.forEach { tId ->
        PhotoTagsTable.insert {
          it[PhotoTagsTable.id] = Uuid.random()
          it[PhotoTagsTable.photoId] = photoId
          it[PhotoTagsTable.tagId] = tId
        }
      }
    }

    getPhotoById(photoId, companyId)!!
  }

  fun getPhotoById(photoId: Uuid, companyId: Uuid): Photo? = transaction {
    val row = PhotosTable.selectAll()
      .where { (PhotosTable.id eq photoId) and (PhotosTable.companyId eq companyId) }
      .firstOrNull() ?: return@transaction null

    val tags = getTagsForPhoto(photoId)
    row.toPhoto(tags)
  }

  fun getPhotosByCompany(companyId: Uuid, customerId: Uuid? = null, tagId: Uuid? = null): List<Photo> = transaction {
    var condition: Op<Boolean> = PhotosTable.companyId eq companyId

    if (customerId != null) {
      condition = condition and (PhotosTable.customerId eq customerId)
    }

    if (tagId != null) {
      val photoIdsWithTag = PhotoTagsTable.selectAll()
        .where { PhotoTagsTable.tagId eq tagId }
        .map { it[PhotoTagsTable.photoId].value }

      condition = condition and (PhotosTable.id inList photoIdsWithTag)
    }

    PhotosTable.selectAll()
      .where { condition }
      .map { row ->
        val pId = row[PhotosTable.id].value
        val tags = getTagsForPhoto(pId)
        row.toPhoto(tags)
      }
  }

  fun updatePhoto(
    photoId: Uuid,
    companyId: Uuid,
    title: String? = null,
    description: String? = null,
    customerId: Uuid? = null,
    tagIds: List<Uuid>? = null
  ): Photo? = transaction {
    val existing = getPhotoById(photoId, companyId) ?: return@transaction null

    PhotosTable.update({ (PhotosTable.id eq photoId) and (PhotosTable.companyId eq companyId) }) { update ->
      title?.let { update[PhotosTable.title] = it }
      description?.let { update[PhotosTable.description] = it }
      customerId?.let { update[PhotosTable.customerId] = it }
    }

    if (tagIds != null) {
      // Eski etiketleri temizle ve yenilerini bağla
      PhotoTagsTable.deleteWhere { PhotoTagsTable.photoId eq photoId }
      tagIds.forEach { tId ->
        PhotoTagsTable.insert {
          it[PhotoTagsTable.id] = Uuid.random()
          it[PhotoTagsTable.photoId] = photoId
          it[PhotoTagsTable.tagId] = tId
        }
      }
    }

    getPhotoById(photoId, companyId)
  }

  fun deletePhoto(photoId: Uuid, companyId: Uuid): Boolean = transaction {
    val photo = getPhotoById(photoId, companyId) ?: return@transaction false
    PhotoTagsTable.deleteWhere { PhotoTagsTable.photoId eq photo.id }
    PhotosTable.deleteWhere { PhotosTable.id eq photo.id } > 0
  }

  private fun getTagsForPhoto(photoId: Uuid): List<ImageTag> {
    val tagIds = PhotoTagsTable.selectAll()
      .where { PhotoTagsTable.photoId eq photoId }
      .map { it[PhotoTagsTable.tagId].value }

    if (tagIds.isEmpty()) return emptyList()

    return ImageTagsTable.selectAll()
      .where { ImageTagsTable.id inList tagIds }
      .map { it.toImageTag() }
  }
}
