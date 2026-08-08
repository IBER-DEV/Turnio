/** Puerto en que el backend está publicado en desarrollo (ver
 * `docker-compose.yml`: el 8000 estaba tomado por otro proyecto local). */
const PUERTO_BACKEND_DEV = 8001;

/** A qué backend le habla la app.
 *
 * `VITE_API_BASE_URL` manda siempre que esté definida (es lo que va a
 * usar el despliegue real, donde el API no vive en otro puerto del mismo
 * host). Sin ella, se deriva del **host desde el que se sirvió la app**,
 * no de `localhost`.
 *
 * Esa diferencia es la que hace que la app funcione en el teléfono. Con
 * `localhost` fijo, abrir `http://192.168.1.50:5173` desde un celular de
 * la misma red carga la interfaz —Vite la sirve bien— pero **todas** las
 * llamadas al API van al `localhost` del teléfono, donde no hay nada:
 * el perfil público dice "este negocio no existe" y el login no entra,
 * los dos sin ningún error visible que apunte a la causa. Probar en un
 * celular real es justo lo que hay que poder hacer sin fricción en un
 * producto que es una app Capacitor.
 *
 * Derivarlo también sobrevive a que el router cambie la IP de la máquina,
 * cosa que fijarla en un `.env` no hace.
 *
 * **Vive en su propio módulo por una razón concreta**: hay dos clientes
 * HTTP (`client.ts` con auth y `publico.ts` sin ella, ver el porqué en
 * ese archivo), y la primera versión de este arreglo tocó solo uno. El
 * resultado fue el peor tipo de arreglo a medias — el login empezó a
 * funcionar desde el celular y el perfil público siguió roto, con el
 * mismo mensaje de antes, que parecía un problema de datos. Cualquier
 * cliente nuevo importa de acá.
 */
export function resolverBaseUrl(): string {
  const configurada = import.meta.env.VITE_API_BASE_URL;
  if (configurada) return configurada;

  // `globalThis.location` y no `window`: en los tests (jsdom) existe, pero
  // esto se importa desde módulos que también corren en Node.
  const ubicacion = globalThis.location;
  if (!ubicacion) return `http://localhost:${PUERTO_BACKEND_DEV}`;

  return `${ubicacion.protocol}//${ubicacion.hostname}:${PUERTO_BACKEND_DEV}`;
}
