---
title: "GitHub 项目本地代码上传全流程"
slug: github-upload-workflow
category: "后端基础学习"
tags: [Git, GitHub]
date: 2026-04-04
status: published
summary: "本地项目上传 GitHub 的标准流程与三类典型问题的排查解决"
source: "笔记/后端基础学习/GitHub 项目本地代码上传全流程.md"
---
# GitHub 项目本地代码上传全流程及问题排查与解决报告

---

## 一、项目背景

本次任务为将本地 Web 项目（`untitled1`）上传至 GitHub 远程仓库`study_project_1`。过程中遇到**网络访问拦截、分支名不匹配、远程历史冲突**三类典型问题，最终通过规范操作与针对性排查成功完成上传。本报告完整记录标准上传流程、问题根因分析与解决方案，重点说明网络问题处理、远程分支冲突的安全解决方法。

---

## 二、完整上传流程（从 0 到 1 规范步骤）

### 2.1 本地环境准备与 Git 基础配置

1. 进入本地项目目录：`cd D:\App\JetBrains\IdeaProjects\Web\untitled1`
2. 配置 Git 全局用户信息（邮箱必须与 GitHub 绑定邮箱一致，用于关联账号）：
    
    bash
    
    运行
    
    ```
    git config --global user.name "shanren627"
    git config --global user.email "your_github_email@example.com"
    ```
    
3. 初始化本地 Git 仓库：`git init`
4. 提交本地代码到本地仓库：
    
    bash
    
    运行
    
    ```
    git add .          # 添加所有修改文件
    git commit -m "Initial commit"  # 提交并添加说明
    ```
    

### 2.2 GitHub 远程仓库创建

1. 登录 GitHub，新建仓库`study_project_1`，**核心注意：不要勾选「Add a README file」「Add .gitignore」**，创建空仓库
2. 复制仓库的**SSH 地址**（格式：`git@github.com:shanren627/study_project_1.git`）

### 2.3 关联远程仓库与分支对齐

1. 关联远程仓库：`git remote add origin git@github.com:shanren627/study_project_1.git`
2. 统一本地与远程分支名（GitHub 默认`main`，旧版 Git 默认`master`，需重命名对齐）：
    
    bash
    
    运行
    
    ```
    git branch -M main  # 强制将本地分支重命名为main
    ```
    

### 2.4 代码推送（标准流程）

执行首次推送，关联远程`main`分支：

bash

运行

```
git push -u origin main
```

（后续推送仅需执行`git push`即可）

---

## 三、遇到的问题、原因分析与解决方案

### 3.1 问题 1：网络连接失败，推送被重置

#### 现象

执行`git push -u origin master`时，报错：

plaintext

```
fatal: unable to access 'https://github.com/shanren627/study_project_1/': Recv failure: Connection was reset
```

#### 原因分析

GitHub 官方 HTTPS 地址在中国大陆受网络防火墙（GFW）拦截，TCP 连接被强制断开，Git 无法正常访问远程服务器。

#### 解决方案：配置 SSH 密钥，一劳永逸解决网络问题

1. **生成 SSH 密钥**（Windows PowerShell 直接执行）：
    
    bash
    
    运行
    
    ```
    ssh-keygen -t ed25519 -C "your_github_email@example.com"
    ```
    
    一路回车，使用默认保存位置，无需设置密码。
2. **复制公钥**：打开`C:\Users\你的用户名\.ssh\id_ed25519.pub`，复制文件内全部内容。
3. **GitHub 配置公钥**：登录 GitHub → 右上角头像→`Settings`→`SSH and GPG keys`→`New SSH key`，粘贴公钥并保存。
4. **测试连接**：
    
    bash
    
    运行
    
    ```
    ssh -T git@github.com
    ```
    
    输入`yes`确认主机指纹，出现`Hi shanren627! You've successfully authenticated, but GitHub does not provide shell access.`即配置成功。
5. **修改远程地址为 SSH**：
    
    bash
    
    运行
    
    ```
    git remote set-url origin git@github.com:shanren627/study_project_1.git
    ```
    

---

### 3.2 问题 2：分支名不匹配，推送报错`src refspec main does not match any`

#### 现象

执行`git push -u origin main`时，报错：

plaintext

```
error: src refspec main does not match any
error: failed to push some refs to 'https://github.com/shanren627/study_project_1'
```

#### 原因分析

执行了`git branch -M master`将本地分支强制重命名为`master`，导致本地无`main`分支，而远程 GitHub 默认分支为`main`，分支名不匹配导致推送失败。

#### 解决方案：对齐本地与远程分支名

bash

运行

```
# 1. 查看当前本地分支（确认当前为* master）
git branch
# 2. 强制重命名本地分支为main
git branch -M main
# 3. 再次确认（显示* main即成功）
git branch
```

---

### 3.3 问题 3：远程`main`分支存在本地无的提交，推送被拒（核心问题）

#### 现象

执行`git push -u origin main`时，报错：

plaintext

```
! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'https://github.com/shanren627/study_project_1'
hint: Updates were rejected because the remote contains work that you do not have locally.
```

#### 原因分析

创建 GitHub 仓库时勾选了「Add a README file」，远程仓库自动生成了包含`README.md`的初始提交；而本地仓库是`git init`生成的全新仓库，两者 Git 历史完全不相关（分叉）。Git 为防止覆盖远程内容，拒绝直接推送。

#### 解决方案：采用**场景 1：保留远程内容，安全合并后推送**（无风险，推荐新手使用）

该方案完整保留远程与本地的所有内容，无数据丢失风险，适用于需要保留远程初始文件（如 README、.gitignore）的场景。

1. **确认远程地址为 SSH**（已完成问题 1 的配置）：
    
    bash
    
    运行
    
    ```
    git remote -v
    ```
    
    确认输出为`git@github.com:shanren627/study_project_1.git`。
2. **拉取远程分支内容，允许合并不相关历史**：
    
    bash
    
    运行
    
    ```
    git pull origin main --allow-unrelated-histories
    ```
    
    - 若**无冲突**：Git 自动完成合并，直接进入下一步；
    - 若**有冲突**：打开冲突文件手动修改，执行`git add .` + `git commit -m "merge remote main branch"`完成合并。
    
3. **再次执行推送命令**：
    
    bash
    
    运行
    
    ```
    git push -u origin main
    ```
    
4. **验证结果**：登录 GitHub 仓库页面，确认本地代码与远程`README.md`均已成功上传，推送完成。

---

## 四、总结与避坑指南

### 4.1 流程复盘

本次上传完整经历了「本地初始化→Git 配置→代码提交→SSH 网络配置→分支对齐→远程历史合并→最终推送」全流程，成功解决三类典型问题，完成项目上传。

### 4.2 避坑指南（避免后续踩坑）

1. **新建 GitHub 仓库时，不要勾选「Add a README file」**：从根源避免生成初始提交，防止本地与远程历史分叉。
2. **优先使用 SSH 协议访问 GitHub**：一劳永逸解决国内网络访问问题，后续推送无需额外配置。
3. **推送前先拉取**：养成`git pull`先同步远程代码的习惯，避免历史冲突。
4. **不要随意重命名本地分支**：保持本地与远程分支名一致（统一用`main`），避免分支不匹配问题。
5. **禁止随意使用强制推送（-f）**：仅在确认远程内容完全无用时使用，团队协作中绝对禁止，防止覆盖他人代码。

### 4.3 后续维护

- 后续本地修改代码后，执行`git add .` → `git commit -m "提交说明"` → `git push`即可完成更新。
- 定期`git pull`同步远程代码，保持本地与远程一致。

---

## 五、附录：关键命令速查表

表格

|功能|命令|
|---|---|
|配置 Git 全局用户名|`git config --global user.name "你的昵称"`|
|配置 Git 全局邮箱|`git config --global user.email "GitHub绑定邮箱"`|
|初始化本地仓库|`git init`|
|提交代码|`git add .` → `git commit -m "提交说明"`|
|关联远程仓库|`git remote add origin git@github.com:用户名/仓库名.git`|
|重命名本地分支为 main|`git branch -M main`|
|生成 SSH 密钥|`ssh-keygen -t ed25519 -C "GitHub绑定邮箱"`|
|测试 SSH 连接|`ssh -T git@github.com`|
|修改远程地址为 SSH|`git remote set-url origin git@github.com:用户名/仓库名.git`|
|拉取远程不相关历史|`git pull origin main --allow-unrelated-histories`|
|推送代码到远程|`git push -u origin main`|
