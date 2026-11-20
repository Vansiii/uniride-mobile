package expo.modules.livenessrostro

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.core.content.ContextCompat
import com.amplifyframework.auth.AWSCredentials
import com.amplifyframework.auth.AWSCredentialsProvider
import com.amplifyframework.auth.AuthException
import com.amplifyframework.core.Consumer
import com.amplifyframework.ui.liveness.ui.FaceLivenessDetector
import com.amplifyframework.ui.liveness.ui.LivenessColorScheme
import expo.modules.kotlin.Promise

class DatosLiveness(
  val sesionId: String,
  val region: String,
  val accessKeyId: String,
  val secretAccessKey: String,
  val sessionToken: String,
  val expiraEnSegundos: Long,
)

/** Credenciales temporales de 15 min que entregó la API, solo para abrir el video de la prueba de vida. */
private class ProveedorTemporal(private val d: DatosLiveness) : AWSCredentialsProvider<AWSCredentials> {
  override fun fetchAWSCredentials(onSuccess: Consumer<AWSCredentials>, onError: Consumer<AuthException>) {
    val c = AWSCredentials.createAWSCredentials(d.accessKeyId, d.secretAccessKey, d.sessionToken, d.expiraEnSegundos)
    if (c != null) onSuccess.accept(c)
    else onError.accept(AuthException("Credenciales de liveness inválidas", "Pide una sesión nueva"))
  }
}

class LivenessActividad : ComponentActivity() {
  companion object {
    @Volatile var pendiente: Promise? = null
    @Volatile var datos: DatosLiveness? = null
  }

  private var terminado = false

  private val pedirCamara =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { concedido ->
      if (concedido) mostrar() else cerrar("CAMARA_DENEGADA")
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (datos == null) {
      cerrar("LIVENESS_SIN_DATOS")
      return
    }
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) mostrar()
    else pedirCamara.launch(Manifest.permission.CAMERA)
  }

  private fun mostrar() {
    val d = datos ?: return cerrar("LIVENESS_SIN_DATOS")
    setContent {
      MaterialTheme(colorScheme = LivenessColorScheme.default()) {
        FaceLivenessDetector(
          sessionId = d.sesionId,
          region = d.region,
          credentialsProvider = ProveedorTemporal(d),
          onComplete = { cerrar(null) },
          onError = { error -> cerrar(codigoDe(error)) },
        )
      }
    }
  }

  /** Código estable para la app; el texto del error del SDK no se envía a la interfaz. */
  private fun codigoDe(error: Any): String =
    when (error.javaClass.simpleName) {
      "UserCancelledException" -> "CANCELADA"
      "CameraPermissionDeniedException" -> "CAMARA_DENEGADA"
      "SessionTimedOutException" -> "SESION_VENCIDA"
      "SessionNotFoundException" -> "SESION_NO_ENCONTRADA"
      "AccessDeniedException" -> "ACCESO_DENEGADO"
      else -> "LIVENESS_ERROR"
    }

  private fun cerrar(error: String?) {
    if (terminado) return
    terminado = true
    val promesa = pendiente
    pendiente = null
    datos = null
    if (error == null) promesa?.resolve(null) else promesa?.reject(error, "Prueba de vida: $error", null)
    finish()
  }

  /** Salir con «atrás» antes de terminar cuenta como cancelar. */
  override fun onDestroy() {
    if (isFinishing) cerrar("CANCELADA")
    super.onDestroy()
  }
}
