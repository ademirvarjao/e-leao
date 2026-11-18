import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./', plugins:[react()], server:{host:'0.0.0.0',allowedHosts:['.e2b.app'],port:5173}, preview:{host:'0.0.0.0',allowedHosts:['.e2b.app']},build:{rollupOptions:{output:{manualChunks:{'react-vendor':['react','react-dom','scheduler'],'supabase-vendor':['@supabase/supabase-js'],'decimal-vendor':['decimal.js']}}}}});
