package com.esta.workforce.data.network

object TokenProvider {
    @Volatile
    private var token: String? = null

    fun setToken(t: String?) {
        token = t
    }

    fun getToken(): String? = token
}
