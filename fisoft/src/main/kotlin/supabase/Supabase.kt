package com.ilyasdemirkiran.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

object SupabaseProvider {

  lateinit var client: SupabaseClient
    private set

  fun initialize(url: String, serviceRoleKey: String) {
    client = createSupabaseClient(
      supabaseUrl = url,
      supabaseKey = serviceRoleKey
    ) {
      install(Postgrest)
      install(Auth)
      install(Storage)
    }

    println("Supabase client initialized.")
  }
}