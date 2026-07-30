package com.ilyasdemirkiran

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.compression.*
import io.ktor.server.plugins.cors.routing.*
import org.slf4j.event.Level

fun Application.configureHttp() {
  install(CallLogging) {
    level = Level.INFO
  }
  install(CORS) {
    allowMethod(HttpMethod.Options)
    allowMethod(HttpMethod.Get)
    allowMethod(HttpMethod.Post)
    allowMethod(HttpMethod.Put)
    allowMethod(HttpMethod.Delete)
    allowMethod(HttpMethod.Patch)
    
    allowHeader(HttpHeaders.Authorization)
    allowHeader(HttpHeaders.ContentType)
    allowHeader(HttpHeaders.AccessControlAllowOrigin)
    allowHeader(HttpHeaders.Accept)
    allowHeader("X-User-Id")
    allowHeader("token")

    allowNonSimpleContentTypes = true
    allowCredentials = true
    anyHost() // @TODO: Don't do this in production if possible. Try to limit it.
  }
  install(Compression)
}
