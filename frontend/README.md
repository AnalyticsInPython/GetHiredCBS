# frontend

Vue 3 + TypeScript single-page app (search/filter UI, results, company and alumni detail views). Talks to the `backend` REST API.

## Stack

- **[Vue 3](https://vuejs.org/)** + **TypeScript**, scaffolded with [create-vue](https://github.com/vuejs/create-vue) (Vite-based)
- **[PrimeVue](https://primevue.org/)** (v4, Aura theme) for UI components
- **ESLint** (flat config, `eslint.config.ts`) + **oxlint** + **Prettier** for linting/formatting
- **[Vitest](https://vitest.dev/)** for unit tests

No router or state-management library (Vue Router / Pinia) yet — add them when the app actually needs multiple views or cross-component shared state.

> Note on PrimeVue: we're pinned to v4 (`primevue` + `@primevue/themes`), which is MIT-licensed. PrimeVue v5 introduced a new licensing model (community/commercial tiers via `@primeui/license-manager`) — worth reading up on before upgrading past v4.

## Setup

```sh
npm install
npm run dev          # start dev server
npm run build         # type-check + production build
npm run test:unit      # run Vitest
npm run lint            # oxlint + eslint --fix
npm run format            # prettier --write
```

## Structure

```
src/
├── main.ts        # app entry, registers PrimeVue
├── App.vue
├── components/
│   └── __tests__/   # Vitest specs
└── assets/
```
