import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 共享字段（时间戳三件套 / 状态机 / 软删除语义，见 phase1-eng §5.2）
const baseSchema = {
  title: z.string(),                              // 中文标题（文件名只放 slug）
  slug: z.string().regex(/^[a-z0-9-]+$/),         // 唯一，= URL
  tags: z.array(z.string()).default([]),
  date: z.coerce.date(),                          // ISO YYYY-MM-DD
  updated: z.coerce.date().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  cover: z.string().optional(),                   // 指向 public/ 下 -thumb.webp
  summary: z.string().max(120),                   // 列表页摘要，AI 生成
  pinned: z.boolean().default(false),
  source: z.string().optional(),                  // 溯源：笔记/FastAPI/xxx.md
};

const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/*.md' }),
  schema: z.object({
    ...baseSchema,
    category: z.string(),                         // 宽松 string + check 脚本推荐列表告警（9 类）
  }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    ...baseSchema,
    category: z.string(),                         // 项目分类（列表页分组，同 notes 宽松 string）
    repo_url: z.string().url().optional(),
    demo_type: z.enum(['static', 'external', 'none']).default('none'),
    demo_url: z.string().optional(),              // static→站内路径；external→外链
    tech_stack: z.array(z.string()).default([]),
    featured: z.boolean().default(false),         // 首页精选项目
  }),
});

const gallery = defineCollection({
  loader: glob({ base: './src/content', pattern: 'gallery.json' }),
  schema: z.object({
    items: z.array(z.object({
      slug: z.string(),
      src: z.string(),                            // public/images/gallery/ 下文件名
      title: z.string().optional(),
      date: z.coerce.date(),
      status: z.enum(['draft', 'published', 'archived']).default('draft'),
    })),
  }),
});

export const collections = { notes, projects, gallery };
