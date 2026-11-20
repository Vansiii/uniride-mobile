// PB-09: `google-services.json` (Firebase, notificaciones push) no va al repositorio: cada equipo usa el de su
// proyecto de Firebase para `com.uniride.app`. Sin él la app compila igual, pero sin avisos push.
const { existsSync } = require('node:fs');

module.exports = ({ config }) =>
  existsSync(`${__dirname}/google-services.json`)
    ? {
        ...config,
        android: {
          ...config.android,
          googleServicesFile: './google-services.json',
        },
      }
    : config;
