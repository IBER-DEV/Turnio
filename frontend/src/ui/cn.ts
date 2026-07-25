/** Une clases condicionales sin traer una dependencia solo para esto. */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
