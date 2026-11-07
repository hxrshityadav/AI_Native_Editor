import { resolve } from 'node:path';
export default {
  root: import.meta.dirname,
  publicDir: resolve(import.meta.dirname, '../../public'),
  esbuild: { jsx: 'automatic' },
  build: { copyPublicDir: false },
  css: { postcss: { plugins: [] } },
  resolve: { alias: { 'react-dom': resolve('node_modules/react-dom'), react: resolve('node_modules/react'), 'lucide-react': resolve('node_modules/lucide-react') } },
  server: { host: '127.0.0.1', port: 3196, fs: { allow: [resolve('.')] } },
};
