#!/bin/bash
# Corre DENTRO del contenedor (lo lanza compilar.sh). Variables: FIRMA_CLAVE, EXPO_PUBLIC_API_URL.
set -e
mkdir -p /work && cd /src
tar --exclude=./node_modules --exclude=./android --exclude=./.expo --exclude=./.git --exclude=./compilar-android -cf - . | tar -xf - -C /work
cd /work
npm ci --no-audit --no-fund
npx expo prebuild --platform android --no-install

KS=/firma/uniride-release.jks
if [ ! -f $KS ]; then
  keytool -genkeypair -keystore $KS -alias uniride -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$FIRMA_CLAVE" -keypass "$FIRMA_CLAVE" -dname "CN=UniRide, O=UniRide, C=BO"
fi

# Firma de release con la llave propia (la de depuración es pública: nadie debe poder firmar como UniRide con ella).
python3 - <<'PY'
p='android/app/build.gradle'
s=open(p).read()
s=s.replace("    buildTypes {","""    signingConfigs.create('release') {
        storeFile file('/firma/uniride-release.jks')
        storePassword System.getenv('FIRMA_CLAVE')
        keyAlias 'uniride'
        keyPassword System.getenv('FIRMA_CLAVE')
    }
    buildTypes {""",1)
i=s.index("        release {")
s=s[:i]+s[i:].replace("signingConfig signingConfigs.debug","signingConfig signingConfigs.release",1)
open(p,'w').write(s)
PY

# Memoria: con 7,5 GB de Docker el Gradle se cae con más paralelismo o con heap menor.
sed -i 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx2560m -XX:MaxMetaspaceSize=512m/' android/gradle.properties
cd android
# Sin lint: el análisis de lint se atasca en el recolector de basura y no aporta al APK.
./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a -Dorg.gradle.workers.max=2 \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
cp app/build/outputs/apk/release/app-release.apk /out/uniride.apk
keytool -list -v -keystore $KS -storepass "$FIRMA_CLAVE" | grep SHA256 | tee /out/huella.txt
