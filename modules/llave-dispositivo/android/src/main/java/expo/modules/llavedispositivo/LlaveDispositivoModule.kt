package expo.modules.llavedispositivo

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.ECGenParameterSpec

private const val PROVEEDOR = "AndroidKeyStore"
private const val ALIAS = "uniride.llave.dispositivo"

private fun noDisponible(motivo: String, causa: Throwable? = null) =
  CodedException("KEYSTORE_NO_DISPONIBLE", motivo, causa)

/** Los textos del diálogo vienen de JS: los de la app viven solo en es-BO.json. */
class TextosHuella : Record {
  @Field
  var titulo: String = ""

  @Field
  var subtitulo: String = ""

  @Field
  var cancelar: String = ""
}

/**
 * Llave de hardware del dispositivo (HU-09 RN-2, A-04): ECDSA P-256 no exportable en AndroidKeyStore, con biometría
 * fuerte en cada firma. La huella se ata a la operación con CryptoObject: sin ella el Keystore no firma, aunque
 * alguien manipule el JS.
 */
class LlaveDispositivoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LlaveDispositivo")

    AsyncFunction("crearLlave") { crearLlave() }

    AsyncFunction("firmar") { mensaje: String, textos: TextosHuella, promesa: Promise ->
      firmar(mensaje, textos, promesa)
    }.runOnQueue(Queues.MAIN)

    // Hermes no trae `crypto.getRandomValues`.
    Function("nonceAleatorio") {
      val bytes = ByteArray(16)
      SecureRandom().nextBytes(bytes)
      bytes.joinToString("") { "%02x".format(it) }
    }
  }

  private fun crearLlave(): String {
    val contexto = appContext.reactContext ?: throw noDisponible("Sin contexto de la app")
    if (BiometricManager.from(contexto).canAuthenticate(BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
      throw noDisponible("El teléfono no tiene biometría fuerte lista")
    }
    val par = try {
      generarPar(strongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
    } catch (_: StrongBoxUnavailableException) {
      generarPar(strongBox = false)
    }
    // RN-2: en un teléfono sin TEE el Keystore cae a software sin avisar; esa llave no sirve.
    val info = KeyFactory.getInstance(par.private.algorithm, PROVEEDOR)
      .getKeySpec(par.private, KeyInfo::class.java)
    @Suppress("DEPRECATION")
    if (!info.isInsideSecureHardware) {
      KeyStore.getInstance(PROVEEDOR).apply { load(null) }.deleteEntry(ALIAS)
      throw noDisponible("La llave no quedó en hardware seguro")
    }
    val cuerpo = Base64.encodeToString(par.public.encoded, Base64.NO_WRAP).chunked(64).joinToString("\n")
    return "-----BEGIN PUBLIC KEY-----\n$cuerpo\n-----END PUBLIC KEY-----\n"
  }

  private fun generarPar(strongBox: Boolean) =
    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVEEDOR).run {
      val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // 0 s de validez: la autenticación vale para una sola operación, y solo con biometría fuerte.
        spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
      }
      if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        spec.setIsStrongBoxBacked(true)
      }
      initialize(spec.build())
      generateKeyPair()
    }

  private fun firmar(mensaje: String, textos: TextosHuella, promesa: Promise) {
    val actividad = appContext.currentActivity as? FragmentActivity
      ?: return promesa.reject(noDisponible("La app no está en primer plano"))
    val firma = try {
      val llave = KeyStore.getInstance(PROVEEDOR).apply { load(null) }.getKey(ALIAS, null) as? PrivateKey
        ?: return promesa.reject(noDisponible("Este teléfono no tiene llave"))
      Signature.getInstance("SHA256withECDSA").apply { initSign(llave) }
    } catch (error: Exception) {
      // Incluye KeyPermanentlyInvalidatedException: se registró otra huella y la llave ya no vale (A-04).
      return promesa.reject(noDisponible("La llave no se puede usar", error))
    }

    val aviso = BiometricPrompt.PromptInfo.Builder()
      .setTitle(textos.titulo)
      .setSubtitle(textos.subtitulo)
      .setNegativeButtonText(textos.cancelar)
      .setAllowedAuthenticators(BIOMETRIC_STRONG)
      .build()

    BiometricPrompt(
      actividad,
      ContextCompat.getMainExecutor(actividad),
      object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(resultado: BiometricPrompt.AuthenticationResult) {
          try {
            val autenticada = resultado.cryptoObject?.signature
              ?: return promesa.reject(noDisponible("Sin operación autenticada"))
            autenticada.update(mensaje.toByteArray(Charsets.UTF_8))
            promesa.resolve(Base64.encodeToString(autenticada.sign(), Base64.NO_WRAP))
          } catch (error: Exception) {
            promesa.reject(noDisponible("El Keystore no firmó", error))
          }
        }

        // Una huella que no coincide no termina el diálogo (onAuthenticationFailed): la persona reintenta.
        override fun onAuthenticationError(codigo: Int, texto: CharSequence) {
          val cancelada = codigo == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
            codigo == BiometricPrompt.ERROR_USER_CANCELED ||
            codigo == BiometricPrompt.ERROR_CANCELED ||
            codigo == BiometricPrompt.ERROR_TIMEOUT
          promesa.reject(
            if (cancelada) {
              CodedException("BIOMETRIA_CANCELADA", texto.toString(), null)
            } else {
              noDisponible(texto.toString())
            }
          )
        }
      }
    ).authenticate(aviso, BiometricPrompt.CryptoObject(firma))
  }
}
