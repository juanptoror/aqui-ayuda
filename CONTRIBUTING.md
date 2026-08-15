# Cómo trabajamos

## Nomenclatura de issues y commits

```
<tipo>(<equipo>): <acción>
```

La misma fórmula para el título de un issue y para el asunto de un commit, así
que leer `git log` y leer el tablero cuesta lo mismo.

### Tipos

| Tipo | Cuándo |
|---|---|
| `feat` | Nueva funcionalidad |
| `bug` | Corrección |
| `qa` | Pruebas y validación |
| `design` | UX, UI o flujo |
| `chore` | Setup y configuración |
| `security` | Seguridad |
| `docs` | Documentación |
| `spike` | Investigación corta |

### Equipos

`back` · `front` · `wa` (experiencia WhatsApp) · `ux`

### Ejemplos

```
chore(back): inicializar proyecto con FastAPI
feat(back): implementar CRUD de solicitudes
design(front): crear mockup de home
feat(wa): enviar solicitud capturada a la API
design(ux): definir sitemap
```

La acción va en infinitivo y describe **qué se hace**, no qué se tocó. El
detalle del porqué va en el cuerpo del commit, que es donde se lee cuando algo
falla meses después.

## Labels

- Equipo: `team:back`, `team:front`, `team:wa`, `team:ux`
- Prioridad: `priority:p0`, `priority:p1`, `priority:p2`
- Tipo: el mismo del título (`feat`, `bug`, `design`, …)

| Prioridad | Significa |
|---|---|
| **P0** | Bloquea o es indispensable |
| **P1** | MVP |
| **P2** | Mejora |

## Qué lleva un issue

Tres apartados, siempre:

```markdown
## Objetivo
Para qué existe esto, en una o dos frases.

## Alcance
Qué entra. Y si algo obvio NO entra, se dice.

## Criterios de aceptación
- [ ] Comprobable por alguien que no lo programó.
```

Un criterio de aceptación que no se pueda verificar mirando la app o corriendo
un comando no es un criterio: es un deseo.

## Antes de abrir un PR

```bash
npm run build     # tsc + vite, sin errores
npm run test      # Playwright
```

Si tocaste algo que se ve, míralo renderizado antes de pedir revisión:

```bash
npm run capturas:viewport
```
