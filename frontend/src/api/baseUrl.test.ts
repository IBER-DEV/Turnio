import { afterEach, describe, expect, it, vi } from "vitest";

import { resolverBaseUrl } from "./baseUrl";

function simularUbicacion(protocol: string, hostname: string) {
  vi.stubGlobal("location", { protocol, hostname });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolverBaseUrl", () => {
  it("apunta al mismo host desde el que se sirvió la app", () => {
    // El caso que rompía: abrir la app desde un celular de la red local.
    // Con `localhost` fijo, la interfaz cargaba pero ninguna llamada al
    // API llegaba a ninguna parte — iban al `localhost` del teléfono.
    simularUbicacion("http:", "192.168.1.144");

    expect(resolverBaseUrl()).toBe("http://192.168.1.144:8001");
  });

  it("en la máquina de desarrollo sigue siendo localhost", () => {
    simularUbicacion("http:", "localhost");

    expect(resolverBaseUrl()).toBe("http://localhost:8001");
  });

  it("respeta el protocolo, para no mezclar https con http", () => {
    simularUbicacion("https:", "turnio.app");

    expect(resolverBaseUrl()).toBe("https://turnio.app:8001");
  });

  it("`VITE_API_BASE_URL` manda por encima de todo", () => {
    // Es lo que va a usar el despliegue real, donde el API no vive en
    // otro puerto del mismo host.
    vi.stubEnv("VITE_API_BASE_URL", "https://api.turnio.app");
    simularUbicacion("https:", "turnio.app");

    expect(resolverBaseUrl()).toBe("https://api.turnio.app");
  });
});
