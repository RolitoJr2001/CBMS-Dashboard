import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // or your respective framework plugin

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Splitting heavy node_modules dependencies into a separate chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
