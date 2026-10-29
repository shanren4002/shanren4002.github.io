// @ts-check
import { defineConfig } from 'astro/config';

// TODO(M0): 拿到 GitHub 用户名后，将 USERNAME 替换为实际值（定 canonical URL 与 sitemap）
export default defineConfig({
  site: 'https://USERNAME.github.io',
  base: '/', // 用户站点根路径部署（<username>.github.io）
  build: {
    // 小于 4KB 的样式表内联进 HTML，省一次往返（JS 预算 ≤50KB 约束下的默认优化）
    inlineStylesheets: 'auto',
  },
});
