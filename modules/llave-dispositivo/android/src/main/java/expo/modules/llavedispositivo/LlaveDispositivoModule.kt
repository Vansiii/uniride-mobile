package expo.modules.llavedispositivo

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyPermanentlyInvalidatedException
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
private const val ALIAS_ALTERNO = "$ALIAS.2"
private const val PREFERENCIAS = "uniride.llave"
private const val CLAVE_ACTIVA = "alias_activo"

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

    AsyncFunction("confirmarLlave") { confirmarLlave() }

    AsyncFunction("firmar") { antes: String, despues: String, textos: TextosHuella, promesa: Promise ->
      firmar(antes, despues, textos, promesa)
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
    val puede = BiometricManager.from(contexto).canAuthenticate(BIOMETRIC_STRONG)
    if (puede != BiometricManager.BIOMETRIC_SUCCESS) {
      if (puede == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED || puede == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) {
        throw CodedException("SIN_BIOMETRIA", "El teléfono no tiene biometría fuerte configurada", null)
      }
      throw noDisponible("El teléfono no tiene biometría fuerte lista")
    }
    // HU-10: la llave nueva va al otro alias; la que firma no se toca hasta que el servidor la acepte.
    val alias = aliasPendiente(contexto)
    val par = try {
      generarPar(alias, strongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
    } catch (_: StrongBoxUnavailableException) {
      generarPar(alias, strongBox = false)
    }
    // RN-2: en un teléfono sin TEE el Keystore cae a software sin avisar; esa llave no sirve.
    val info = KeyFactory.getInstance(par.private.algorithm, PROVEEDOR)
      .getKeySpec(par.private, KeyInfo::class.java)
    @Suppress("DEPRECATION")
    if (!info.isInsideSecureHardware) {
      almacen().deleteEntry(alias)
      throw noDisponible("La llave no quedó en hardware seguro")
    }
    val cuerpo = Base64.encodeToString(par.public.encoded, Base64.NO_WRAP).chunked(64).joinToString("\n")
    return "-----BEGIN PUBLIC KEY-----\n$cuerpo\n-----END PUBLIC KEY-----\n"
  }

  private fun almacen() = KeyStore.getInstance(PROVEEDOR).apply { load(null) }

  private fun preferencias(contexto: Context) = contexto.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE)

  /** Sin preferencia guardada, la activa es `ALIAS`: así siguen valiendo las llaves creadas antes de HU-10. */
  private fun aliasActivo(contexto: Context) = preferencias(contexto).getString(CLAVE_ACTIVA, ALIAS) ?: ALIAS

  private fun aliasPendiente(contexto: Context) = if (aliasActivo(contexto) == ALIAS) ALIAS_ALTERNO else ALIAS

  /** El servidor aceptó la llave nueva: pasa a ser la que firma y la anterior se borra. */
  private fun confirmarLlave() {
    val contexto = appContext.reactContext ?: throw noDisponible("Sin contexto de la app")
    val nuevo = aliasPendiente(contexto)
    val anterior = aliasActivo(contexto)
    val llaves = almacen()
    if (!llaves.containsAlias(nuevo)) throw CodedException("SIN_LLAVE", "No hay llave nueva que confirmar", null)
    if (!preferencias(contexto).edit().putString(CLAVE_ACTIVA, nuevo).commit()) {
      throw noDisponible("No se pudo guardar la llave activa")
    }
    llaves.deleteEntry(anterior)
  }

  private fun generarPar(alias: String, strongBox: Boolean) =
    KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVEEDOR).run {
      val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
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

  /**
   * Firma `antes + hora + despues`. La hora se toma tras la huella: el tiempo con el diálogo abierto no gasta
   * la ventana de 30 s del servidor.
   */
  private fun firmar(antes: String, despues: String, textos: TextosHuella, promesa: Promise) {
    val actividad = appContext.currentActivity as? FragmentActivity
      ?: return promesa.reject(noDisponible("La app no está en primer plano"))
    val firma = try {
      val llave = almacen().getKey(aliasActivo(actividad), null) as? PrivateKey
        ?: return promesa.reject(CodedException("SIN_LLAVE", "Este teléfono no tiene llave", null))
      Signature.getInstance("SHA256withECDSA").apply { initSign(llave) }
    } catch (error: KeyPermanentlyInvalidatedException) {
      return promesa.reject(CodedException("LLAVE_ANULADA", "Se registró una huella nueva", error))
    } catch (error: Exception) {
      if (error.cause is KeyPermanentlyInvalidatedException) {
        return promesa.reject(CodedException("LLAVE_ANULADA", "Se registró una huella nueva", error))
      }
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
            val marca = System.currentTimeMillis().toString()
            autenticada.update((antes + marca + despues).toByteArray(Charsets.UTF_8))
            promesa.resolve(
              mapOf("firma" to Base64.encodeToString(autenticada.sign(), Base64.NO_WRAP), "marca" to marca)
            )
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
          val bloqueada = codigo == BiometricPrompt.ERROR_LOCKOUT ||
            codigo == BiometricPrompt.ERROR_LOCKOUT_PERMANENT
          val sinBiometria = codigo == BiometricPrompt.ERROR_NO_BIOMETRICS ||
            codigo == BiometricPrompt.ERROR_HW_NOT_PRESENT ||
            codigo == BiometricPrompt.ERROR_HW_UNAVAILABLE

          val excepcion = when {
            cancelada -> CodedException("BIOMETRIA_CANCELADA", texto.toString(), null)
            bloqueada -> CodedException("BIOMETRIA_BLOQUEADA", texto.toString(), null)
            sinBiometria -> CodedException("SIN_BIOMETRIA", texto.toString(), null)
            else -> noDisponible(texto.toString())
          }
          promesa.reject(excepcion)
        }
      }
    ).authenticate(aviso, BiometricPrompt.CryptoObject(firma))
  }
}

