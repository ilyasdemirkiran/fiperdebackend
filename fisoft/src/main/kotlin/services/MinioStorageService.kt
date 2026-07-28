package com.ilyasdemirkiran.services

import io.minio.BucketExistsArgs
import io.minio.MakeBucketArgs
import io.minio.MinioClient
import io.minio.PutObjectArgs
import io.minio.RemoveObjectArgs
import io.minio.SetBucketPolicyArgs
import java.io.InputStream
import kotlin.uuid.Uuid

class MinioStorageService(
  endpoint: String = System.getenv("MINIO_URL") ?: "http://localhost:9000",
  accessKey: String = System.getenv("MINIO_ACCESS_KEY") ?: "minioadmin",
  secretKey: String = System.getenv("MINIO_SECRET_KEY") ?: "minioadminpassword",
  val bucketName: String = System.getenv("MINIO_BUCKET_NAME") ?: "fiperde-media"
) {

  private val minioClient: MinioClient = MinioClient.builder()
    .endpoint(endpoint)
    .credentials(accessKey, secretKey)
    .build()

  init {
    ensureBucketExists()
  }

  private fun ensureBucketExists() {
    try {
      val found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())
      if (!found) {
        minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build())
        
        // Public read policy for bucket
        val policy = """
          {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": ["arn:aws:s3:::$bucketName/*"]
              }
            ]
          }
        """.trimIndent()

        minioClient.setBucketPolicy(
          SetBucketPolicyArgs.builder()
            .bucket(bucketName)
            .config(policy)
            .build()
        )
      }
    } catch (e: Exception) {
      println("MinIO initialization notice: ${e.message}")
    }
  }

  fun uploadFile(
    inputStream: InputStream,
    filename: String,
    contentType: String,
    size: Long,
    companyId: Uuid
  ): Pair<String, String> {
    val extension = filename.substringAfterLast('.', "jpg")
    val objectName = "companies/$companyId/photos/${Uuid.random()}.$extension"

    minioClient.putObject(
      PutObjectArgs.builder()
        .bucket(bucketName)
        .`object`(objectName)
        .stream(inputStream, size, -1)
        .contentType(contentType)
        .build()
    )

    val publicUrl = "/storage/$objectName"
    return Pair(objectName, publicUrl)
  }

  fun deleteFile(objectName: String): Boolean {
    return try {
      minioClient.removeObject(
        RemoveObjectArgs.builder()
          .bucket(bucketName)
          .`object`(objectName)
          .build()
      )
      true
    } catch (e: Exception) {
      false
    }
  }
}
