#!/bin/bash
# Compila el APK de UniRide en Linux (Docker). Uso, desde mobile/:  bash compilar-android/compilar.sh <url-de-la-api>
# Ejemplo: bash compilar-android/compilar.sh https://d27m7kukd6ob9b.cloudfront.net/api/v1
set -e
API="${1:?Falta la URL de la API (termina en /api/v1)}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(dirname "$AQUI")"
SALIDA="${SALIDA:-$RAIZ/../apk-salida}"   # aquí quedan uniride.apk y huella.txt
FIRMA="${FIRMA:-$HOME/.uniride-firma}"    # aquí vive la llave de firma: NO va al repositorio
mkdir -p "$SALIDA" "$FIRMA"
[ -f "$FIRMA/clave.txt" ] || openssl rand -hex 16 > "$FIRMA/clave.txt"
docker image inspect uniride-android >/dev/null 2>&1 || docker build -t uniride-android "$AQUI"
# Cache opcional (compilar la segunda vez en minutos): CACHE=1 bash compilar-android/compilar.sh ...
VOL=""
[ -n "$CACHE" ] && VOL="-v uniride-gradle:/root/.gradle -v uniride-npm:/root/.npm"
MSYS_NO_PATHCONV=1 docker run --rm --cpus="${CPUS:-6}" -m 7g \
  -e FIRMA_CLAVE="$(cat "$FIRMA/clave.txt")" -e EXPO_PUBLIC_API_URL="$API" \
  -v "$RAIZ:/src:ro" -v "$FIRMA:/firma" -v "$SALIDA:/out" -v "$AQUI/construir.sh:/construir.sh:ro" $VOL \
  uniride-android bash /construir.sh
echo "Listo: $SALIDA/uniride.apk"
