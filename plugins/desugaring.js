const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * El componente de AWS Face Liveness (modules/liveness-rostro) usa APIs de Java 8: el módulo `:app` tiene que activar
 * el soporte de «core library desugaring» o `checkReleaseAarMetadata` rechaza la compilación.
 */
module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (!g.includes('coreLibraryDesugaringEnabled')) {
      g = g.replace(
        /^android\s*\{/m,
        'android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }',
      );
      g = g.replace(
        /^dependencies\s*\{/m,
        "dependencies {\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'",
      );
    }
    c.modResults.contents = g;
    return c;
  });
