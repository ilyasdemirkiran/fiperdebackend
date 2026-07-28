package com.ilyasdemirkiran.types.media

import com.ilyasdemirkiran.types.FIUsersTable
import com.ilyasdemirkiran.types.companies.CompaniesTable
import com.ilyasdemirkiran.types.customers.CustomersTable
import com.ilyasdemirkiran.utils.InstantSerializer
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.dao.id.UuidTable
import org.jetbrains.exposed.v1.javatime.timestamp
import java.time.Instant
import kotlin.uuid.Uuid

// Tag / Label Table (Company-scoped)
object ImageTagsTable : UuidTable("image_tags") {
  val companyId = reference("company_id", CompaniesTable).index()
  val name = varchar("name", 100).index()
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  init {
    index(isUnique = true, companyId, name)
  }
}

@Serializable
data class ImageTag(
  val id: Uuid,
  val companyId: Uuid,
  val name: String,
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

fun ResultRow.toImageTag() = ImageTag(
  id = this[ImageTagsTable.id].value,
  companyId = this[ImageTagsTable.companyId].value,
  name = this[ImageTagsTable.name],
  createdAt = this[ImageTagsTable.createdAt]
)

// Photos / Gallery Table (Customer-scoped or User/Company Gallery)
object PhotosTable : UuidTable("photos") {
  val companyId = reference("company_id", CompaniesTable).index()
  val customerId = reference("customer_id", CustomersTable).nullable().index() // null = Firma genel galeri fotosu
  val uploaderId = reference("uploader_id", FIUsersTable).index()
  val title = varchar("title", 200)
  val description = varchar("description", 1000).default("")
  val url = varchar("url", 1000)
  val filename = varchar("filename", 255)
  val mimeType = varchar("mime_type", 100).default("image/jpeg")
  val size = long("size").default(0L)
  val createdAt = timestamp("created_at").clientDefault { Instant.now() }

  init {
    index(isUnique = false, companyId, customerId)
  }
}

@Serializable
data class Photo(
  val id: Uuid,
  val companyId: Uuid,
  val customerId: Uuid? = null,
  val uploaderId: Uuid,
  val title: String,
  val description: String = "",
  val url: String,
  val filename: String,
  val mimeType: String = "image/jpeg",
  val size: Long = 0L,
  val tags: List<ImageTag> = emptyList(),
  @Serializable(with = InstantSerializer::class) val createdAt: Instant
)

fun ResultRow.toPhoto(tags: List<ImageTag> = emptyList()) = Photo(
  id = this[PhotosTable.id].value,
  companyId = this[PhotosTable.companyId].value,
  customerId = this[PhotosTable.customerId]?.value,
  uploaderId = this[PhotosTable.uploaderId].value,
  title = this[PhotosTable.title],
  description = this[PhotosTable.description],
  url = this[PhotosTable.url],
  filename = this[PhotosTable.filename],
  mimeType = this[PhotosTable.mimeType],
  size = this[PhotosTable.size],
  tags = tags,
  createdAt = this[PhotosTable.createdAt]
)

// Junction Table: Photo <-> Tag (Many-to-Many with CASCADE ON DELETE)
object PhotoTagsTable : UuidTable("photo_tags") {
  val photoId = reference("photo_id", PhotosTable).index()
  val tagId = reference("tag_id", ImageTagsTable).index()

  init {
    index(isUnique = true, photoId, tagId)
  }
}
