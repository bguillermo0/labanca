# La Banca — NOVATOS vs VETERANOS (Netlify)

Cada equipo abre su enlace con el llavero NFC y ve su saldo, solo lectura. La banca abre el suyo y cambia los saldos. Los móviles de los equipos consultan cada segundo, así que el cambio aparece en 1 o 2 segundos.

## Estructura

```
public/index.html              La web (marcador de equipo y panel de la banca)
netlify/functions/api.mjs      Función de Netlify (guarda el saldo en Netlify Blobs)
netlify/functions/core.mjs     Lógica de saldos y comprobación de llaves
netlify/functions/tokens.mjs   Las 3 llaves secretas de los llaveros
netlify.toml                   Configuración
test.mjs                       Pruebas (npm test)
```

## Desplegar (elige una vía)

Esta web usa una función con una dependencia (`@netlify/blobs`), así que necesita que Netlify haga el build. Por eso no uses el arrastrar y soltar de "Netlify Drop".

### Opción A: con GitHub
1. Crea un repositorio privado en GitHub y sube esta carpeta (sin `node_modules`).
2. En Netlify: Add new site → Import an existing project → elige el repositorio.
3. No cambies nada en la configuración de build (la lee de `netlify.toml`) y pulsa Deploy.

### Opción B: con la CLI de Netlify
```bash
npm install
npx netlify login
npx netlify init        # crea el sitio
npx netlify deploy --prod
```

Cuando termine tendrás una dirección tipo `https://tu-sitio.netlify.app`.

## Las 3 URLs de los llaveros

Abre `netlify/functions/tokens.mjs`. Cada llavero lleva una dirección formada con tu dominio y una de las llaves:

| Llavero | URL |
|---|---|
| NOVATOS | `https://tu-sitio.netlify.app/t/<llave novatos>` |
| VETERANOS | `https://tu-sitio.netlify.app/t/<llave veteranos>` |
| BANCA | `https://tu-sitio.netlify.app/b/<llave banca>` |

La llave de la banca es la única que permite cambiar saldos. No la enseñes ni la pongas en una pantalla compartida.

Si quieres llaves nuevas, cambia las cadenas de `tokens.mjs` por otras aleatorias de al menos 32 caracteres y vuelve a desplegar. Los llaveros antiguos dejarán de funcionar.

## Grabar los llaveros NFC

Con la app NFC Tools (iOS y Android): Escribir → Añadir un registro → URL → pega la dirección → Escribir. Prueba cada llavero con un móvil antes de la dinámica. Si quieres, bloquéalos como solo lectura al terminar.

## Panel de la banca

- Fichas de ±10, 50, 100 y 250, y una cantidad libre con + y −.
- Fijar el saldo exacto.
- Deshacer el último movimiento.
- Reiniciar ambos equipos a 500 € (pide confirmar con una segunda pulsación).
- Historial con la hora de cada movimiento.

## Notas

- Los saldos se guardan en Netlify Blobs y sobreviven a nuevos despliegues. Para empezar de cero usa "Reiniciar a 500 €".
- La consulta cada segundo se cambia con la constante `POLL_MS` al principio del script de `public/index.html`. Más segundos gastan menos del plan gratuito.
- La función rechaza cualquier petición de la banca que no lleve la llave de la banca, y responde igual a una llave inventada que a una ruta que no existe.
