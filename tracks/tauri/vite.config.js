import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
var host = process.env.TAURI_DEV_HOST;
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3000';
    return {
        plugins: [react(), tailwindcss()],
        clearScreen: false,
        server: {
            port: 1420,
            strictPort: true,
            host: host || false,
            hmr: host
                ? {
                    protocol: 'ws',
                    host: host,
                    port: 1421,
                }
                : undefined,
            proxy: {
                '/ws': {
                    target: proxyTarget,
                    ws: true,
                    changeOrigin: true,
                },
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                },
            },
            watch: {
                ignored: ['**/src-tauri/**'],
            },
        },
    };
});
