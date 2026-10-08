import { defineConfig,devices } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',testMatch:'*.spec.ts',fullyParallel:false,workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:5174',trace:'retain-on-failure'},webServer:[
  {command:'pnpm exec tsx tests/e2e/server.ts',url:'http://127.0.0.1:5001/api/products',reuseExistingServer:false,timeout:90000},
  {command:'pnpm --filter @workspace/nativos-precificacao exec vite --mode e2e --host 127.0.0.1',url:'http://127.0.0.1:5174',reuseExistingServer:false,env:{WEB_PORT:'5174',API_PORT:'5001',VITE_CLERK_PUBLISHABLE_KEY:'pk_test_test'},timeout:90000}
],projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
