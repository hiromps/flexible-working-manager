# Theme

## `src/app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-primary: #0457a7;
  --color-secondary: #005a96;
  --color-accent: #e4c057;
  --color-error: #e73858;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

## `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

## Tokens

- Primary: `#0457a7`
- Secondary: `#005a96`
- Accent: `#e4c057`
- Error: `#e73858`
- Neutral foreground: `#171717`
- Page background: `#ffffff`, with frequent page-local `bg-gray-50`
- Font: Geist via Next font variables, page body currently falls back to Arial/Helvetica
- Existing radius pattern: rounded-lg, rounded-xl, rounded-2xl, rounded-3xl
- Existing shadows: shadow-sm, shadow-lg, shadow-xl, shadow-2xl

