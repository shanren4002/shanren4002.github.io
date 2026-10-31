/**
 * worker/src/github.js —— GitHub API 客户端（Contents / Git Data / Actions）
 *
 * 凭据：fine-grained PAT 存 Worker secret GITHUB_PAT（Contents R/W + Actions R/W，限单仓）。
 * 主发布通道 publishCommit()：blob → tree → commit → update ref 单 commit 原子入库，
 * md 与图片同一 commit，不产生逐文件中间 commit（全案 §6.3）。
 */

const DEFAULT_API = 'https://api.github.com';

async function ghFetch(env, path, options = {}) {
  const base = (env && env.GITHUB_API_BASE) || DEFAULT_API;
  const res = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'portfolio-backend-worker',
      ...(options.headers || {}),
    },
  });
  return res;
}

function repoPath(env, path) {
  return `/repos/${env.GITHUB_REPO}/contents/${path}`;
}

/** 读仓库文件：{ content(utf-8 文本或 base64), sha, size, encoding }；不存在返回 null */
export async function getFile(env, path) {
  const res = await ghFetch(env, repoPath(env, path));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} 失败: ${res.status}`);
  const data = await res.json();
  return { sha: data.sha, size: data.size, encoding: data.encoding, content: data.content };
}

/** 列目录（用于序号递增/查重）：[{name, size}]；不存在返回 [] */
export async function listDir(env, path) {
  const res = await ghFetch(env, repoPath(env, path));
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub LIST ${path} 失败: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((it) => ({ name: it.name, size: it.size, type: it.type }));
}

/** 单文件写（Contents API）。files: [{path, contentBase64, message}] 单个 */
export async function putFile(env, path, contentBase64, message) {
  const existing = await getFile(env, path);
  const body = { message, content: contentBase64 };
  if (existing) body.sha = existing.sha;
  const res = await ghFetch(env, repoPath(env, path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${path} 失败: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.commit && data.commit.sha;
}

/**
 * 单 commit 原子发布（Git Data API）。
 * @param {object} env
 * @param {Array<{path: string, contentBase64: string}>} files
 * @param {string} message
 * @returns {Promise<string>} 新 commit sha
 */
export async function publishCommit(env, files, message) {
  if (!files.length) throw new Error('没有要发布的文件');

  // 1. 当前 main 引用 → commit → tree
  const refRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/ref/heads/main`);
  if (!refRes.ok) throw new Error(`读取 main 引用失败: ${refRes.status}`);
  const refData = await refRes.json();
  const parentSha = refData.object.sha;

  const commitRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/commits/${parentSha}`);
  if (!commitRes.ok) throw new Error(`读取 HEAD commit 失败: ${commitRes.status}`);
  const baseTree = (await commitRes.json()).tree.sha;

  // 2. 逐文件建 blob
  const tree = [];
  for (const f of files) {
    const blobRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: f.contentBase64, encoding: 'base64' }),
    });
    if (!blobRes.ok) throw new Error(`创建 blob 失败(${f.path}): ${blobRes.status}`);
    const blob = await blobRes.json();
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 3. tree → commit → 更新 ref
  const treeRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });
  if (!treeRes.ok) throw new Error(`创建 tree 失败: ${treeRes.status}`);
  const newTree = (await treeRes.json()).sha;

  const newCommitRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: newTree, parents: [parentSha] }),
  });
  if (!newCommitRes.ok) throw new Error(`创建 commit 失败: ${newCommitRes.status}`);
  const newCommit = (await newCommitRes.json()).sha;

  const updateRes = await ghFetch(env, `/repos/${env.GITHUB_REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit }),
  });
  if (!updateRes.ok) throw new Error(`更新 main 引用失败: ${updateRes.status}`);

  return newCommit;
}

/** 手动重新部署（作者自救通道）：workflow_dispatch */
export async function dispatchDeploy(env) {
  const res = await ghFetch(env, `/repos/${env.GITHUB_REPO}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (res.status === 404) throw new Error('未找到 deploy.yml 工作流（部署通道异常，请检查 CI 配置）');
  if (!res.ok) throw new Error(`触发重新部署失败: ${res.status}`);
  return true;
}
