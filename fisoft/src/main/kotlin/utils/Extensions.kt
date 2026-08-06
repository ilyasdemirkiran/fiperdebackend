package com.ilyasdemirkiran.utils

import kotlin.uuid.Uuid

fun String.toUuid(): Uuid = Uuid.parse(this)