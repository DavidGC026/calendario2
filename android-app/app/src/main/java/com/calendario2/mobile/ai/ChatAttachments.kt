package com.calendario2.mobile.ai

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream

/**
 * Utilidades para convertir imágenes locales (URI o ruta) en data URLs
 * base64 listos para enviarse al backend `/api/chat` como parts `type=file`.
 *
 * Compresión:
 *  - JPEG calidad 80
 *  - Lado mayor máx. 1280 px
 *  - Respeta EXIF para no mandar imágenes giradas.
 */
object ChatAttachments {
    private const val MAX_DIM = 1280
    private const val JPEG_QUALITY = 80

    fun fromUri(context: Context, uri: Uri): String? {
        return try {
            val resolver: ContentResolver = context.contentResolver
            val src = resolver.openInputStream(uri).use { input ->
                input ?: return null
                BitmapFactory.decodeStream(input)
            } ?: return null
            val rotated = applyExifRotation(resolver, uri, src)
            val resized = downscale(rotated)
            encodeJpegBase64(resized)
        } catch (_: Exception) {
            null
        }
    }

    fun fromFilePath(path: String): String? {
        return try {
            val src = BitmapFactory.decodeFile(path) ?: return null
            val ei = try { ExifInterface(path) } catch (_: Exception) { null }
            val rotated = ei?.let { rotateByExif(src, it) } ?: src
            val resized = downscale(rotated)
            encodeJpegBase64(resized)
        } catch (_: Exception) {
            null
        }
    }

    private fun applyExifRotation(resolver: ContentResolver, uri: Uri, bmp: Bitmap): Bitmap {
        return try {
            resolver.openInputStream(uri).use { input ->
                input ?: return bmp
                val ei = ExifInterface(input)
                rotateByExif(bmp, ei)
            }
        } catch (_: Exception) {
            bmp
        }
    }

    private fun rotateByExif(bmp: Bitmap, ei: ExifInterface): Bitmap {
        val orientation = ei.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            else -> return bmp
        }
        return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
    }

    private fun downscale(bmp: Bitmap): Bitmap {
        val maxSide = maxOf(bmp.width, bmp.height)
        if (maxSide <= MAX_DIM) return bmp
        val scale = MAX_DIM.toFloat() / maxSide
        val w = (bmp.width * scale).toInt().coerceAtLeast(1)
        val h = (bmp.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bmp, w, h, true)
    }

    private fun encodeJpegBase64(bmp: Bitmap): String {
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$b64"
    }
}
