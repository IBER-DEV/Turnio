# Turnio — Frontend

App Capacitor (web admin del negocio, por ahora) para Turnio. Ver
[`CLAUDE.md`](CLAUDE.md) para reglas de esta carpeta y
[`ROADMAP-FRONTEND.md`](ROADMAP-FRONTEND.md) para el estado detallado.

## Stack

React + TypeScript + Vite + React Router + Capacitor. Sin librería de
UI ni de data-fetching/estado (Context + `useState`/`useEffect`
alcanza para el alcance de Fase 1); ver justificación en
`ROADMAP-FRONTEND.md`.

## Desarrollo local

Requiere que el backend esté corriendo (ver `../README.md`).

```bash
cp .env.example .env   # si no existe aún (VITE_API_BASE_URL)
npm install
npm run dev
```

Abre `http://localhost:5173`.

### Regenerar los tipos del contrato

Cada vez que el backend cambie `openapi.yaml` (ver `../CONTRATO.md`):

```bash
npm run generate:types
```

Esto regenera `src/api/schema.ts`. Si el build falla después, es que
el contrato cambió de forma que rompe una pantalla — revisa
`../CONTRATO.md` antes de parchear el tipo a mano.

### Build

```bash
npm run build
```
