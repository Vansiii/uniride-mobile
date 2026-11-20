# Compilar el APK de UniRide (sin cuenta de Expo)

Compila en Linux dentro de Docker. En Windows no se puede: el NDK no enlaza `react-native-worklets` ni `react-native-screens`.

## Pasos

1. Abre Docker Desktop (con 7 GB de memoria o más).
2. Desde `mobile/`: `bash compilar-android/compilar.sh https://<dominio>/api/v1`
3. Sale `uniride.apk` y `huella.txt` (SHA-256 de la firma) en `../apk-salida/`.

La primera vez construye la imagen (unos 3 min) y compila (**30–40 min**). Con `CACHE=1` guarda las dependencias de Gradle y npm en volúmenes de Docker: las siguientes compilaciones bajan a unos 10 min.

## Notificaciones push (PB-09, Firebase)

Sin `mobile/google-services.json` el APK compila igual, pero el perfil muestra «Notificaciones: No disponibles». Para activarlas (una sola vez):

1. En <https://console.firebase.google.com> crea un proyecto (Analytics no hace falta) y agrega una app **Android** con el paquete `com.uniride.app`.
2. Descarga `google-services.json` y déjalo en `mobile/` (está en `.gitignore`; no es un secreto, pero es de este proyecto).
3. En Configuración del proyecto → Cuentas de servicio → «Generar nueva clave privada»: baja un JSON. **Ese sí es secreto.** En producción va en base64 a SSM: `FCM_CUENTA_SERVICIO_B64=$(base64 -w0 cuenta.json)` y `PUSH_MODO=fcm` en `/uniride/env`, luego `bash /opt/desplegar-api.sh <etiqueta>`.
4. Recompila el APK. El `google-services.json` debe ser del **mismo** proyecto que la cuenta de servicio, o FCM responde 403/404.

## Firma

El APK se firma con una llave propia en `~/.uniride-firma/` (`uniride-release.jks` y `clave.txt`). **Guárdala fuera del repo y no la pierdas.** El servidor acepta solo la huella de esa firma (`ATESTACION_FIRMA_SHA256`, PB-07): si cambia la llave, cambia la huella y hay que reconfigurar producción. No uses la llave de depuración: es pública.

## Lo que costó aprender (ya está resuelto en los scripts)

- **Memoria:** con 7,5 GB, más de 2 procesos de Gradle o un heap menor a 2,5 GB tumban Docker (`daemon disappeared`, error 502). Usa `CPUS=6` como máximo.
- **Lint:** `lintVitalAnalyzeRelease` se queda dando vueltas al 366 % de CPU; se salta con `-x`.
- **Saltos de línea:** los `.sh` deben tener LF, no CRLF (hay un `.gitattributes`). Con CRLF falla con `set: -: invalid option`.
- **`gradle.properties`:** el archivo generado no termina en salto de línea; no le agregues líneas con `echo >>` sin `printf "\n..."`.
- Solo arm64 (`-PreactNativeArchitectures=arm64-v8a`): los teléfonos Android actuales. Para x86 (emulador) quita ese parámetro; tarda el doble.
- No usa `MODO_SIMULADO`: la build de release nunca simula la atestación.
