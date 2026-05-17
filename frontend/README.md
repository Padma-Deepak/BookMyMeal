# BookMyMeal Frontend

This is the React + TypeScript frontend for the BookMyMeal project.

## Setup and Running

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```

## Configuration

The frontend is configured to proxy API requests to the Django backend running on `http://localhost:8000`.
This is defined in `vite.config.ts`.

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
    '/media': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```
