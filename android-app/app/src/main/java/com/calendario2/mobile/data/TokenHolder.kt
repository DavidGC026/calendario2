package com.calendario2.mobile.data

/**
 * Token en memoria; [TokenStore] persiste en DataStore.
 */
object TokenHolder {
    @Volatile
    var token: String? = null
}
