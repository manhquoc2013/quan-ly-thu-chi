import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@ui': resolve(__dirname, 'src/ui'),
            '@components': resolve(__dirname, 'src/ui/components'),
            '@screens': resolve(__dirname, 'src/ui/screens'),
            '@store': resolve(__dirname, 'src/store'),
            '@services': resolve(__dirname, 'src/services'),
            '@models': resolve(__dirname, 'src/models'),
            '@utils': resolve(__dirname, 'src/utils'),
            '@hooks': resolve(__dirname, 'src/hooks'),
        },
    },
    server: {
        port: 5173,
        host: true,
    },
});
