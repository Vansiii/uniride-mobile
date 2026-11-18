# AGENTS.md — uniride-mobile

Este repositorio contiene la app de conductor y pasajero (Expo / React Native) de UniRide y es un **submódulo** del repositorio principal [Vansiii/uniride](https://github.com/Vansiii/uniride).

Antes de cualquier cambio, lee en el repositorio principal:

1. `.agents/MEMORY/HEARTBEAT.md`: estado actual y próximo paso.
2. `AGENTS.md`: reglas del proyecto. Rigen completas aquí.
3. `SPECS/features/HU-xx-slug/spec.md` y `plan.md` de la historia en curso. No se escribe código sin ambos aprobados.

Lo propio de este repositorio:

- Comandos: los de la fila `mobile/` de `AGENTS.md` §9 del principal; Node.js 24 LTS (`.nvmrc`).
- Ramas `main` y `develop` protegidas; una rama `feat/HU-xx-slug` por historia; PR con CI en verde y revisión de otro integrante.
- Commits `HU-xx SPyy: descripción`.
- Al terminar un PR aquí, actualiza en el principal el puntero del submódulo `mobile` y el estado en `.agents/`.
- Hermes (el motor de JavaScript de la app) no trae `crypto` de Node ni `crypto.subtle`, y Jest corre en Node, donde sí existen: una prueba verde no detecta su uso. Para hashes, aleatorios y firmas usa `src/dispositivo/sha256.ts` y el módulo nativo detrás de `keystore.ts`; nunca importes `crypto` ni `node:crypto` en `src/`.
