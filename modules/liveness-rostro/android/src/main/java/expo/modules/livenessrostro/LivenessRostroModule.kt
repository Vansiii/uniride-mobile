package expo.modules.livenessrostro

import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Frontera nativa de Rekognition Face Liveness (AGENTS.md §4, RN-4). Solo abre la cámara y envía el video a AWS con
 * las credenciales temporales que la API entrega (A-01: el teléfono no decide nada; el resultado lo lee el servidor
 * con el `sesionId`). Resuelve al terminar el flujo y rechaza con un código si falla o se cancela.
 */
class LivenessRostroModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LivenessRostro")

    AsyncFunction("iniciar") { sesionId: String, region: String, accessKeyId: String,
                               secretAccessKey: String, sessionToken: String,
                               expiraEnSegundos: Double, promise: Promise ->
      val actividad = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      if (LivenessActividad.pendiente != null) {
        promise.reject("LIVENESS_EN_CURSO", "Ya hay una prueba de vida abierta", null)
        return@AsyncFunction
      }
      LivenessActividad.pendiente = promise
      LivenessActividad.datos = DatosLiveness(
        sesionId, region, accessKeyId, secretAccessKey, sessionToken, expiraEnSegundos.toLong(),
      )
      actividad.startActivity(Intent(actividad, LivenessActividad::class.java))
    }
  }
}
