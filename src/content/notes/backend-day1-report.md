---
title: "后端学习 Day 1 报告"
slug: backend-day1-report
category: "后端基础学习"
tags: [后端, 学习日志]
date: 2026-03-12
status: published
summary: "Ubuntu 下 Java 开发环境配置与 Git 身份初始化记录"
source: "笔记/后端基础学习/day 1 报告.md"
---
日期： 2026年3月12日

1. 今日完成工作 (Tasks Completed)
• 环境基建：在 Ubuntu 系统下完成 Java 开发环境配置，安装并验证了 OpenJDK 17。
	sudo apt install openjdk-17-jdk -y
	java --version

• Git 身份初始化：配置全局 user.name 与 user.email，建立了本地代码提交的责任制。
	 git config --global user-name " "
	 git config --global user-email " "
	 
   项目工程化起步：
• 在 Linux 下建立标准工作目录结构 ~/workspace/learning。
	 mkdir -p ~/workspace/learing
	 
	Linux 中`cd`命令切换目录需区分路径类型：`/`是系统根目录，`~`代表用户主目录（/home/ 用户名），无前缀为相对当前目录的路径。
	
• 成功从 GitHub 克隆中台规范项目 mall-tiny。
	 git clone 仓库链接
	
• 核心命令实战：
• 掌握 Linux 目录切换（cd）、权限查看（ls -l）与文件编辑（vim）。
• 实操 Git 核心流：status (状态监测)、add (暂存)、commit (提交)。
• 进阶实战：模拟并触发了 Git 代码合并冲突 (Conflict)。

	git status：状态检测是否对文件进行了修改
	git log --online --graph --all：查看提交历史
	

2. 技术收获与感悟 (Key Learnings)
• Linux 哲学：理解了“一切皆文件”以及在命令行下通过 source 刷新配置、通过 chmod 管理权限的基础逻辑。
• Git 深度理解：
• 明确了本地仓库与远程官网的关系，消除了“修改本地代码会弄坏官网”的顾虑。
• 掌握了 git log 的不同展示方式（如 --oneline），用于快速回溯项目历史。
• 理解了 git restore 在不同阶段（工作区 vs 暂存区）的撤销策略。



3. 产出物 (Artifacts)
• 本地配置成功的 Ubuntu Java 运行环境。
• 包含自定义注释记录的 Local Git Repository。
• 处于 MERGING 状态的 冲突代码现场（待解决）。
