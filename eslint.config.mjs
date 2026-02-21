export default [
  {
    files: ["src/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        game: "readonly",
        Hooks: "readonly",
        ui: "readonly",
        Item: "readonly",
        Items: "readonly",
        Actor: "readonly",
        CONFIG: "readonly",
        Handlebars: "readonly",
        Dialog: "readonly",
        foundry: "readonly",
        fromUuid: "readonly",
        console: "readonly",
      },
    },
    rules: {},
  },
];
