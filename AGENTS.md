# AGENTS.md — Echoes 项目执行规范

> 本文件面向 AI 编码代理（Agent），规范行为准则、强制检查项和常见陷阱。
> 与 `.planning/` 文件冲突时，以 `.planning/` 为准。

---

## P0 — 不可违反（Hard Rules）

| # | 规则 | 说明 | 违反后果 |
|---|------|------|----------|
| 1 | **交付质量我负责** | 任何改动必须端到端测试后才能声明完成 | 回退 + 重新测试 |
| 2 | **闭环开发** | 写代码前想完整流程，写完测成功路径+边界 | 代码交付不完整 |
| 3 | **默认中文输出** | 用户消息是中文 → 回复中文（代码/错误信息/用户写英文除外）| 用户体验差 |
| 4 | **RTK 前缀命令** | 所有 Bash 命令前缀 `rtk` | 命令不可追溯 |
| 5 | **更新 ROADMAP.md + STATE.md** | Phase/Plan 完成后必须同步更新规划文档 | 文档与进度脱节 |
| 6 | **Push 分支** | develop 领先 origin 时，阶段完成后必须推送到远程 | 协作断档 |

## P1 — 必须警觉（Guard Rails）

| # | 规则 | 触发场景 |
|---|------|----------|
| 7 | **动手验证优先** | 思考超 3 分钟无进展 → curl / console / docker logs |
| 8 | **Docker 不改不 rebuild** | 改代码只重启容器，改 Dockerfile/依赖才 rebuild |
| 9 | **小步快跑提交** | 完成一个独立修复点就 commit，不要攒 |
| 10 | **状态一致性检查** | HANDOFF / MEMORY / STATE / ROADMAP 必须互相同步 |
| 11 | **检查活跃错题** | 动手前读 `mistake-log.md`，相似场景警觉 |

## P2 — 注意项（Watchouts）

| # | 规则 | 触发场景 |
|---|------|----------|
| 12 | **bool + omitempty** | Go struct 中 bool 带 omitempty 会导致 false 被跳过 |
| 13 | **全局 CSS 选择器禁忌** | 禁止 `* { transition: ... }` 等全局选择器覆盖 |
| 14 | **shadcn 版本匹配** | Tailwind v3 项目必须用 shadcn v3 CLI |
| 15 | **OKLCH 变量格式** | 用 `var(--x)` 不用 `hsl(var(--x))` |
| 16 | **Tailwind 透明度无效** | `ring-foreground/10` 在 OKLCH 下无效，改用 border/shadow |
| 17 | **浏览器缓存陷阱** | 前端修改后必须 Disable cache / Ctrl+Shift+R 验证 |
| 18 | **Playwright 局限性** | 前端视觉问题必须在真实浏览器中验证，Playwright 仅作辅助 |

---

## 阶段完成 Checklist（Phase Complete Checklist）

每次 Phase / 里程碑完成后，按顺序执行：

- [ ] 1. 更新 `STATE.md` — 标记当前 Phase 已完成
- [ ] 2. 更新 `ROADMAP.md` — 修改状态列（规划中 → 已完成）
- [ ] 3. 更新 `MEMORY.md` — 同步项目状态
- [ ] 4. 更新 `HANDOFF.md` — 当前工作状态、已修复问题、待解决问题
- [ ] 5. 更新 `mistake-log.md` — 如有新增错题立即记录
- [ ] 6. **Commit** — `git add -A && git commit`
- [ ] 7. **Push** — `git push origin develop`
- [ ] 8. 告知用户完成情况 + 下一步建议

---

## 活跃错题索引

详见 `C:\Users\Yongbin\.claude\projects\D--xProjects-Vibe-Echoes\memory\mistake-log.md`

| 时间 | 场景 | 修正措施 |
|------|------|----------|
| 05-03 | 全局 CSS transition | 禁止 `*` 选择器设置 transition |
| 05-03 | shadcn v4 + Tailwind v3 | v3 项目用 shadcn v3 CLI |
| 05-03 | OKLCH 变量格式 | 用 `var(--x)` 不用 `hsl(var(--x))` |
| 05-03 | Logo 默认尺寸 | 约束容器显式设置 size |
| 05-03 | shadcn Dropdown focus vs hover | 测试 hover/focus 行为，显式添加 `hover:` |
| 05-03 | 浏览器缓存 | 前端修改 Disable cache / Ctrl+Shift+R |
| 05-03 | Tailwind 透明度 + OKLCH | 改用 border 或纯色 shadow |
| 05-03 | localStorage 默认值 | 默认值必须与产品默认值一致 |
| 05-03 | Playwright 局限性 | 真实浏览器验证，Playwright 仅辅助 |
| 05-03 | 未更新 ROADMAP.md | 阶段完成 checklist 必须执行 |
| 05-03 | 未 push develop 分支 | 阶段完成后必须 `git push origin develop` |

---

*Generated: 2026-05-03 | Source: HANDOFF.md + mistake-log.md + MEMORY.md*
