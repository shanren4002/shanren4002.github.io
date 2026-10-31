// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 用户站点（2026-10-29 确认用户名：shanren4002）
export default defineConfig({
  site: 'https://shanren4002.github.io',
  base: '/', // 用户站点根路径部署（<username>.github.io）
  integrations: [sitemap()], // M4：sitemap-index.xml 自动生成（SEO 验收件）
  build: {
    // 小于 4KB 的样式表内联进 HTML，省一次往返（JS 预算 ≤50KB 约束下的默认优化）
    inlineStylesheets: 'auto',
  },
});
