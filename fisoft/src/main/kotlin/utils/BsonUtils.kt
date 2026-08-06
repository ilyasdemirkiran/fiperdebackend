package com.ilyasdemirkiran.utils

import org.bson.Document
import org.bson.types.ObjectId
import java.time.Instant

object BsonUtils {
    fun safeGetString(doc: Document, key: String): String? {
        val value = doc.get(key) ?: return null
        return when (value) {
            is String -> value
            is ObjectId -> value.toHexString()
            is java.util.Date -> value.toInstant().toString()
            is Document -> {
                val secObj = value.get("_seconds") ?: value.get("seconds")
                val seconds = when (secObj) {
                    is Number -> secObj.toLong()
                    is String -> secObj.toLongOrNull()
                    else -> null
                }
                if (seconds != null) {
                    Instant.ofEpochSecond(seconds).toString()
                } else {
                    value.toString()
                }
            }
            else -> value.toString()
        }
    }

    fun safeGetDouble(doc: Document, key: String): Double? {
        val value = doc.get(key) ?: return null
        return when (value) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull()
            else -> null
        }
    }

    fun safeGetLong(doc: Document, key: String): Long? {
        val value = doc.get(key) ?: return null
        return when (value) {
            is Number -> value.toLong()
            is String -> value.toLongOrNull()
            else -> null
        }
    }

    fun safeGetInt(doc: Document, key: String): Int? {
        val value = doc.get(key) ?: return null
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
    }
}
