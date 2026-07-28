/**
 * Cuerpos `multipart/form-data` para `openapi-fetch`.
 *
 * Por qué existe: OpenAPI no sabe expresar "acá va un archivo". Un
 * `ImageField` de DRF aparece en el schema como `type: string, format:
 * uri` —que es la forma de **salida**, la URL— así que el tipo generado
 * para el body pide un `string` donde hay que mandar un `File`. Cualquier
 * subida choca contra eso, y la salida barata sería un `as never` suelto
 * en cada pantalla que sube algo.
 *
 * Acá el cast vive **una sola vez**, encapsulado, y los call sites quedan
 * honestos: `body: cuerpoMultipart<FotoNegocio>({ imagen: archivo })`.
 * `openapi-fetch` reconoce `FormData` y deja que el navegador ponga el
 * `Content-Type` con su `boundary` — por eso no se toca ninguna cabecera
 * acá.
 *
 * El tipo se pasa **explícito** en vez de dejarlo inferir del contexto:
 * en un endpoint con body obligatorio, la inferencia trae el `| undefined`
 * del propio parámetro y termina rechazando lo que sí es válido. Nombrar
 * el schema además documenta contra qué forma se está mandando.
 *
 * Convención de valores, alineada con `CONTRATO.md` 5.12:
 * - `undefined` → el campo **no viaja** (es lo que hace parcial a un PATCH).
 * - `null` → viaja vacío, que es como se le pide al backend que **borre**
 *   ese archivo (`logo: null` deja el negocio sin logo).
 */
export function cuerpoMultipart<T>(
  campos: Record<string, string | number | boolean | Blob | null | undefined>,
): T {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor === undefined) continue;
    if (valor === null) {
      datos.append(campo, "");
    } else if (valor instanceof Blob) {
      datos.append(campo, valor);
    } else {
      datos.append(campo, String(valor));
    }
  }
  // El único cast del asunto: `FormData` no es lo que el schema declara,
  // pero sí es lo que el endpoint acepta.
  return datos as unknown as T;
}
