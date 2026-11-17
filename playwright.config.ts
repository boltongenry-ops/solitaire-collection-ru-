import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./scripts',testMatch:'*.spec.ts',fullyParallel:true,workers:2,timeout:25000,
  use:{baseURL:'http://127.0.0.1:5180',viewport:{width:1440,height:1000},headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-proxy-server']},screenshot:'only-on-failure'},
  webServer:{command:'npx vite preview --host 0.0.0.0 --port 5180 --strictPort',port:5180,reuseExistingServer:!process.env.CI},
});
