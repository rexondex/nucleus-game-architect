/**
 * Module boundaries are executable architecture rules.
 * Keep this file in sync with docs/architecture.md when folders change.
 */
module.exports = {
  forbidden: [
    {
      name: 'nucleus-must-stay-framework-independent',
      severity: 'error',
      from: { path: '^src/01_nucleus-core/' },
      to: { path: '^src/(02_api-controller|03_graphics-projection|04_ui-interface)/' },
    },
    {
      name: 'api-controller-only-imports-nucleus',
      severity: 'error',
      from: { path: '^src/02_api-controller/' },
      to: { path: '^src/(03_graphics-projection|04_ui-interface)/' },
    },
    {
      name: 'graphics-must-not-own-dom-or-core-state',
      severity: 'error',
      from: { path: '^src/03_graphics-projection/' },
      to: { path: '^src/(01_nucleus-core|04_ui-interface)/' },
    },
    {
      name: 'ui-must-use-api-for-core-access',
      severity: 'error',
      from: { path: '^src/04_ui-interface/' },
      to: { path: '^src/01_nucleus-core/' },
    },
    {
      name: 'nucleus-must-not-import-rendering-frameworks',
      severity: 'error',
      from: { path: '^src/01_nucleus-core/' },
      to: { path: '^(react|react-dom|@react-three/fiber|three)(/|$)' },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.app.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
}
