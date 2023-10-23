# Hydro

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/hydro-dev/hydro/build.yml?branch=master)
![hydrooj](https://img.shields.io/npm/dm/hydrooj)
![npm](https://img.shields.io/npm/v/hydrooj?label=hydrooj)
![node-current](https://img.shields.io/node/v/hydrooj)
![GitHub contributors](https://img.shields.io/github/contributors/hydro-dev/Hydro)
![GitHub commit activity](https://img.shields.io/github/commit-activity/y/hydro-dev/Hydro)

Hydro 是一个高效信息学在线测评系统。易安装，跨平台，多功能，可扩展，有题库。

对于不熟悉 Linux 或是懒得运维的老师，我们也提供了免费开通即用的在线版本，  
详情前往 [https://hydro.ac](https://hydro.ac) 查看 [操作指引](https://hydro.ac/discuss/6172ceeed850d38c79ae18f9)  

将安装命令粘贴到控制台一键安装，安装后注册首个用户自动获得超级管理员权限。
兼容主流 Linux 发行版，推荐使用 Ubuntu 22.04，支持 arm64 设备（树莓派等）

```sh
LANG=zh . <(curl https://hydro.ac/setup.sh)
```

[中文文档](https://hydro.js.org/) / [English](./README-EN.md)  

相关文档若说明的不够详细，请提交 Pull Request 或联系开发组说明。  
bug 和功能建议请在 Issues 提出。  

## 系统特点

### 模块化设计，插件系统，功能热插拔

Hydro 设计了一套模块化的插件系统，可以方便地扩展系统功能。  
使用插件系统，可以在修改功能后，仍然保证系统的可升级性。  
Hydro 的所有历史版本均可平滑升级到最新版本。  

插件使用和开发指南，请前往文档 [插件](https://docs.hydro.ac/plugins/) 和 [开发](https://docs.hydro.ac/dev/typescript/) 章节。

### 跨平台兼容，数据一键备份/导入

Hydro 支持所有主流的 Linux 发行版，兼容 x86_64 和 arm64 架构设备，且均可一键安装。  
Hydro 可在 树莓派 / Apple M1 上正常运行。

使用 `hydrooj backup` 即可备份系统全部数据，使用 `hydrooj restore 文件名` 即可导入备份数据。
整个过程无需手工干预。

### 单系统多空间，不同班级/院校，分开管理

Hydro 提供了单系统多空间支持，可以方便地为不同的班级/年级/院校等创建独立的空间。  
不同空间内除用户外数据默认隔离，且可分配独立管理员，互不干扰。  
题目可跨域复制，在系统内仅占用一份空间。

### 粒度精细的权限系统，灵活调节

Hydro 的权限可以按比赛/作业分配给对应的用户，也可以将用户分组（班级），按组分配权限。
有关权限节点，可以查看 [介绍](https://docs.hydro.ac/docs/) 下方截图。

### 规模化支持，上千用户无压力，伸缩组秒级自动扩展

Hydro 系统本身是无状态的，这意味着你可以随意增删服务节点，而不会影响系统的正常运行。
评测队列会自动在当前在线的所有评测机间均衡分配。接入弹性伸缩组后，可根据服务器负载情况自动增删评测机。
不像其他系统，Hydro 会管理不同服务器间的测试数据缓存，按需拉取，做到评测机上线即用，无需手动同步数据。

### 全题型支持，跟随时代潮流

Hydro 支持所有题型。无论是传统题型，Special Judge，还是文件输入输出，提交答案题，IO 交互，函数交互，乃至选择填空题等，
Hydro 都有相应的支持。安装相关运行环境后，Hydro 甚至可以做到：

- 调用小海龟画图，与标准图片比对；
- 调用 GPU 进行机器学习模型的评测；

更多的样例可前往 [样例区](https://hydro.ac/d/system_test/) 查看并下载。

### 丰富的题库

Hydro 支持导入常见格式的题库文件，包括 Hydro 通用的 zip 格式，HUSTOJ 导出的 FPS (xml) 格式题目，QDUOJ 导出的压缩包。  
可以在 [Hydro 题库](https://hydro.ac/d/tk/p) 下载免费题库使用。  
Hydro 同时支持 VJudge，这意味着你可以直接在系统内导入其他平台的题目，修改题面后编入自己的作业或比赛，快速搭建自己的题库体系。  
当前支持的平台有：  

- [一本通编程启蒙](https://hydro.ac/ybtbas.zip)：官方提供一本通编程启蒙题库，免费使用，参照压缩包内导入说明。
- [Codeforces](https://codeforces.com)：国外大型竞赛平台，大量高质量题目；
- [UOJ](https://uoj.ac)：国内知名 OJ，国家集训队常用；
- [SPOJ](https://www.spoj.com)：国内连接很不稳定，不推荐；
- [洛谷](https://www.luogu.com.cn)：使用此功能需要向洛谷购买授权；
- [CSGOJ](https://cpc.csgrandeur.cn)；
- [POJ](https://poj.org)：较为古董，服务器稳定性差；
- HUSTOJ：理论上支持所有 HUSTOJ 驱动的系统，但由于各个系统中 UI 有差异，通常需要手动适配。

### 多赛制支持

Hydro 支持多种赛制，包括 ACM/ICPC 赛制（支持封榜），OI 赛制，IOI 赛制，乐多赛制，以及作业功能。  
在 IOI 和 OI 赛制下，支持订正题目功能，学生在赛后可以在题库中提交对应题目，其分数会在榜单旁边显示。  
在 IOI 和 OI 赛制下，支持灵活时间功能，学生可以在设定的时间范围内，自选 X 小时参赛。  

### 轻松添加其他编程语言

Hydro 的语言设置并非硬编码于系统中，而是使用了配置文件。
只要能写出对应语言的编译命令和运行命令，Hydro 都可以进行判题。

## 联系我们

Email：i@undefined.moe
Hydro 用户群：1085853538  
Telegram [@webpack_exports_undefined](https://t.me/webpack_exports_undefined)  

<details>
<summary><h2>更新日志（点击展开）</h2></summary>

### Hydro 4.9.23 / UI 4.48.23
- migrate: hustoj: 导入时忽略不存在的图片
- core: oauth: 使用 OpenID 进行账号关联
- core: 支持根据显示名搜索用户
- core: 支持根据题目难度搜索题目
- ui: 优化首页比赛作业过滤逻辑
- core: 优化测试点识别
- ui: 禁用自测输入的拼写检查

### Hydro 4.9.22 / UI 4.48.22
- ui: 在线IDE：添加设置页面
- core: 导出题目时添加难度信息
- ui: 修复特定情况下 markdown 标签补全出错的问题
- import-qduoj: 检查 pid 合法性
- core: 排序作业列表
- ui: 修复讨论编辑显示
- core: 导出 pwsh 函数
- vjudge: codeforces: 修复比赛 921 爬取异常

### Hydro 4.9.21 / UI 4.48.21
- core: 修复 strictioi 比赛计分
- ui: 修复已参加训练列表显示
- core: 在比赛开始前禁用计分板
- ui: 在添加用户到域的时候隐藏 default 和 guest 选项
- core: 允许管理员筛选所有小组
- ui: 修复语言过滤（#598）
- ui: 修复讨论 reaction

### Hydro 4.9.20 / UI 4.48.20
- vjudge: 修复 Codeforces 提交结果获取
- core: 优化系统自检功能
- vjudge: 支持 detail 设置（#582）
- ui: 禁用视频自动播放
- install: 支持安装时自动从 UOJ 导入数据
- ui: 修复 preferredPrefix 功能异常的问题

### Hydro 4.9.19 / UI 4.48.19
- core: 修复比赛代码导出功能无法处理选手提交的二进制文件的问题
- core: 修复比赛管理显示用户参与排名状态
- core&ui: 支持按小组筛选比赛/作业
- core: 显示 spj 编译超时等详情信息
- core&ui: 导入题目：支持重新整理题号
- core: loader: 添加 git 集成
- install: 添加 k3s 安装样例
- core: 默认仅使用小写文件名
- ui: 在比赛中忽略记住的客观题答案
- core: 移除 langs.domain 选项
- core: 修复修改邮箱后旧邮箱仍被占用的问题
- ui: 部分样式修复

### Hydro 4.9.18 / UI 4.48.18
- ui: 客观题：支持记住上次选择的答案并添加快速跳题
- core: 使用 $HOME/.hydro 存储临时文件
- core: import: 导入时检查 pid 是否合法
- ui: 添加 validAs 相关语言自测支持
- ui: 修复灵活时间模式下比赛进度条显示
- core: 优化导入用户识别
- ui: 记住编辑器字体大小
- core: 支持按标签搜索题目

### Hydro 4.9.17 / UI 4.48.17
- core&ui: 比赛成绩表和训练支持基于组过滤
- judge: 添加并行优先级处理
- core: 为域设置操作添加操作日志
- core: storage: 保存文件时避开 -_ 等字符
- core: 修复评测记录列表页过滤 Waiting 提交不生效的问题
- ui: 修复 Typescript Language Service 工作异常的问题
- ui: 添加域快速导航开关
- core: 添加 PERM_VIEW_HIDDEN_CONTEST 与 PERM_VIEW_HIDDEN_HOMEWORK 权限
- ui: 翻译优化
- core: langs: 添加 validAs 选项
- migrate: 添加 UOJ 支持
- core&ui: 其他漏洞修复和优化

### Hydro 4.9.15 / UI 4.48.15
- ui: 客观题：允许多行答案
- core: 修复 pinnedDomains 无法修改的问题
- install: 调大默认限制
- ui: 优化比赛弹窗通知
- core: 修复比赛选手管理页时间计算
- core: cli: 题目导出时生成默认题目 ID
- core: dump: 支持 --dbOnly 参数
- core: 用户导入: 重复信息检查
- ui: 更改默认版权信息
- core: 支持训练基于置顶等级排序
- ui: 模板热重载

### Hydro 4.9.13 / UI 4.48.13
- fps-import: 支持处理远端评测题目
- vjudge: 添加 VERDICT.WAITING 属性
- ui: 优化测试数据自动识别
- vjudge: 添加一本通编程启蒙支持
- ui: 添加 `problemset/download` 钩子
- ui: 在打印模式下隐藏部分控件
- core: addon create 使用符号链接
- ui: 评测记录页面显示代码行号
- core: 支持从解压的题目文件夹导入题目
- core: setJudge 时添加 PRIV_UNLIMITED_ACCESS

### Hydro 4.9.12 / UI 4.48.12
- core: 修复比赛中讨论不会随比赛删除的问题
- vjudge: codeforces: 更新登陆检查逻辑
- ui: 在题目提交页面显示提示
- core: 更新用户缓存
- core: 强制终止不回应心跳包的 Websocket 连接
- core: 设置导入题目的默认 tag
- core: 默认禁用 Python2
- core: 支持重排序导航栏
- ui: 修复部分情况下进入编辑模式按钮不生效的问题
- core: 添加 hydrooj patch 功能
- core: 允许查看作业中自己的提交
- core: 其他漏洞修复

### Hydro 4.9.8 / UI 4.48.11
- core: 修复 strictioi 下的计分板显示问题
- core: 允许普通用户查看比赛讨论
- core: 启动时自动建立静态资源文件夹
- core: 允许使用其他 UI 模块
- judge: 修复文件 IO 题目输出重定向的问题
- core: 不再向 Guest 用户分配 sessionId
- judge: 修复提交答案题

### Hydro 4.9.7 / UI 4.48.10
- ui: websocket: 添加心跳包
- judge: 修复客观题和文件 IO 题提交
- judge: 添加 compile_time_limit 选项
- core: 添加 kotlin 和 pypy3 预设
- ui: scoreboard: 支持自动更新
- core: contest: 封榜后允许管理员查看实时分数
- judge: 支持按题目设置语言时空限制倍率
- install: 支持自动导入 hustoj 数据
- install: 支持指定安装源
- core: 支持从 npmjs 自动安装插件
- core&ui: 漏洞修复
- judge: 设置最低评测优先级
- core: 修复部分赛制下封榜时仍能查看提交列表的问题

### Hydro 4.9.0 / UI 4.48.0
- core: 优化讨论鉴权
- judge: 优化统一回调评测状态回显
- judge: 移除 `processTestdata` 步骤
- judge: 客观题子任务分数回显
- core: 压平测试数据结构
- core: rp: 修复比赛分数
- core&ui: 首次使用 OAuth 时要求设置密码
- ui: 评测设置 UI 升级
- install: 根据系统内存调整 wtCacheSize
- ui: 加载速度优化
- core: 检测域 ID 大小写
- ui: 导航栏域索引
- ui: 支持按权限组过滤作业/比赛
- judge: 将 Javascript 默认解释器设置为 node
- judge: 修复删除未评测完成的题目导致评测队列卡死的问题

### Hydro 4.8.0 / UI 4.47.6
- core: 升级至 mongodb@5
- ui: 评测详情中显示子任务得分
- core: 修复测试数据文件名以空格开头导致操作异常的问题
- dev: 升级 devcontainer 环境
- ui: 优化 IDE 页面布局
- ui: 使用 cordis 进行生命周期管理（移除旧 bus）
- blog: 移动功能到独立的 `@hydrooj/blog` 插件
- core: 支持动态设置
- judge: 性能模式（关闭单点回调）
- ui: 支持为作业设置维护者
- core: 放行提交答案题至提交语言白名单
- import-qduoj: 修复空标签导致无法导入的问题
- ui: 精简 serviceworker 逻辑
- ui: 修复训练计划加入失败的问题
- core: 简化 user 返回字段列表
- core&ui: contest.rule.ioi.strict
- 其他漏洞修复和体验优化

### Hydro 4.7.3 / UI 4.47.3
- core: 修复无输入自测
- core: 修复 endpointForUser 域名不一致导致的 token 无效问题
- core: 移除 isBinaryFile 检查
- core: 修复 allowViewCode 设置
- core: cli: 优先使用 mongosh
- workspace: 提供 `@hydrooj/eslint-config` 包
- 其他漏洞修复和体验优化

### Hydro 4.7.2 / UI 4.47.2
- core: 修复提交答案题
- ui: 修复作业页面编辑与删除操作
- vjudge: 适配 codeforces 新接口
- core: 过滤空 `$set` 操作
- ui: domain_dashboard 页显示域创建者
- judge: 修复 hack
- core: 提交时检查所选语言是否存在

### Hydro 4.7.0 / UI 4.47.0
- core: 支持检测导致启动卡死的问题
- core: 修复特定情况下 rating 信息无法写入的问题
- core: 添加更多 validator 字段类型支持，移除旧版 validator
- core&ui: 支持 CORS
- ui: 支持模块懒加载
- ui: 修复邮箱登录
- ui: 修复站内信显示异常的问题
- vjudge: luogu: 修复登录
- judge: 修复客观题部分题目未答导致评测出错的问题
- core: `ConnectionHandler` 支持 `@subscribe(event)`
- util: 修复 `Message.sendNotification` 格式化异常的问题
- core: 数据库优化
- core: 校验用户头像
- judge: 移除 onDestory 钩子，使用 disposables 替代
- ui: 优化资源加载

### Hydro 4.6.0 / UI 4.46.0
- core&ui: 添加 webauthn 支持
- ui: 修复题解投票
- ui: 优化比赛详情页布局
- ui: 修复快捷搜索中评测记录链接
- core: 添加 `Types.ArrayOf()` 支持
- ui: 修复侧栏预览保存
- core: 添加 CookieDomain 设置
- ui: 修复 dev 模式下页面无限刷新的问题
- vjudge: 提供 BasicFetcher 组件
- core: DomainModel 缓存
- core&ui: 其他漏洞修复

### Hydro 4.5.2 / UI 4.45.1
- core: 添加乐多赛支持
- vjudge: 移除 puppeteer 相关依赖
- judge: 修复客观题未设置答案导致评测结果不返回的问题
- ui: 默认移除首页右侧搜索模块
- ui: 添加站内头像上传模块
- core: 允许比赛创建者查看隐藏的计分板
- core: 讨论更改为按照创建时间排序
- ui: 修复题解投票回显
- core: 修复找回密码链接合成错误的问题
- judge: 修复文件 IO 题目编译输出限制过小的问题
- core: 修复 `%` 作为关键词会导致题目搜索出错的问题
- core: 修复比赛题目列表下方提交记录模块不显示的问题
- ui: 修复讨论区部分表情预设 ID 和实际图像不匹配的问题
- install: 默认设置 vm.swappiness=1 以提高性能
- ui: 允许普通用户在设置了查询条件时按页翻阅评测记录
- ui: 提交记录列表添加取消成绩按钮
- core: 修复特定情况下访问日志无法记录的问题
- workspace: 支持 pnpm
- workspace: 移除 mocha
- core: 支持使用形如 `handler/before/Name#method` 的筛选
- judge: 性能优化
- ui: 评测记录列表点击重测时页面不再刷新

### Hydro 4.5.1 / UI 4.45.0
- ui: 支持全局快捷搜索
- core: problem_list: 支持 limit 参数
- core: 精简默认讨论节点列表
- core: validator: 双汉字也被认为是合法用户名
- judge: objective: 支持多答案题目
- core: problemStat: 忽略已取消成绩的提交
- ui: 修复讨论编辑 Ctrl+Enter 快捷键
- ui: 修复锁定讨论主题功能
- core: 优化作业鉴权设置
- core: 封榜功能修复
- ui: contest: 允许手动管理参赛人员
- ui: contest: 支持赛时广播消息提醒
- ui: 其他漏洞修复和性能优化

### Hydro 4.5.0 / UI 4.44.0
- fps: 修复题目中含空文件导致导入失败的问题
- core: 封禁用户时支持附加理由
- vjudge: codeforces: 跳过无法访问的 1769 和 1772 比赛
- ui: 收藏题目操作不再触发页面刷新
- core: 重测时检查题目配置文件有效性
- core: 退出时自动清理临时文件
- core: 禁止使用 . 作为文件名
- import-qduoj: 跳过不合法的题目
- core: 修复提交答案题的比赛代码导出
- judge: 添加 stdioLimit 项
- ui: 修复 message.FLAG_ALERT 显示
- core: training 可上传文件
- ui: 优化比赛导航栏
- ui: 比赛成绩表支持关注队伍
- core: 允许克隆比赛/作业
- ui: 比赛编辑页面添加功能入口
- core: 支持打星参赛
- core: 整题重测时跳过已取消成绩的提交

### Hydro 4.4.5 / UI 4.43.0
- core: 修复比赛基于 ID 搜索题目的功能
- judge: 修复 testlib 错误信息显示异常的问题
- sandbox: 提高默认 stdio 限制
- core: 修复讨论历史记录异常的问题
- core: 优化每日任务的运行速度
- core: 用户详情页支持显示用户近期参加的比赛/作业
- judge: 将 Bash 添加到预设语言列表
- vjudge: 在 cli 模式下跳过加载
- lsp: 修复了自动补全的提示，可能需要手动更新后生效
- judge: 优化 diff 输出
- install: 默认使用 mongodb uri 作为数据库连接方式
- ui: 在用户背景加载失败时 fallback 到默认背景
- 文件路径更改为大小写敏感。
- 在前端插件中支持使用 `import { ... } from '@hydrooj/ui-default'` 引入内置库。
- `ctx.inject('Notification')` 支持插入多行文本。

### 4.4.3
- core: 优化了比赛计分板页面的性能
- core: 导入用户时支持指定用户所属小组和学校
- core&ui: 其他漏洞修复和性能优化
- 添加了 `UserModel.getListForRender(domainId, uids)` 方法。
- 添加 `IHandler.response.pjax` 属性。

### 4.4.0
- core: 移除了 Problem.assign
- core: 修复了比赛结束后，若题目仍处于隐藏状态，无法查看代码的问题
- ui: 修复了 IE 浏览器端页脚的显示
- judge: 修复 lemon checker 异常退出导致题目计分为 0 的问题
- ui: 优化管理端的 Firefox 兼容性警告
- ui: 优化 fps 题目导入后的显示
- ui: 修复 IE 浏览器显示语言识别的问题
- install: 检测已安装的宝塔环境并抛出不兼容警告
- ui: 优化部分错误提示
- migrate: 性能优化
- vjudge: 修复 Codeforces 提交记录爬取异常的问题
- `ProblemModel.getList()` 移除了 group 参数，后续参数前移
- `cordis` 升级至 2.6

### 4.3.2
- 修复评测详情页面在特定情况下不会即时更新的问题
- 将 testlib spj 的错误返回至用户侧
- 修复题目文件无法从管理员侧预览的问题

### 4.3.1
- 终止对 NodeJS <14 的支持
- ui: api: 更新了 API Workbench
- judge: 移除环境变量中 \r，添加 Python Packages 说明
- ui: 修改了部分推荐链接
- prom-client: 记录 EventEmitter 信息
- core: contest: 支持导出比赛信息为 Ghost 格式
- core: contest: 优化比赛中提交量和通过量的计算
- core: contest: 封榜时显示 Pending 提交
- judge: 修复客观题未设置答案导致评测跳过的问题
- core: 优化 CsrfTokenError 和 DomainNotFoundError 回显
- core: server: 捕获 WebSocket 错误
- core: validator: 修复可以发送空站内消息的问题
- 其他漏洞修复和性能优化
- 在题目详情页中，Scratchpad.store 可从 Window 上公开访问

### 4.3.0
- 安装时自动安装 Caddy 配置反向代理监听 80 端口。
- 支持使用 `hydrooj install <src>` 和 `hydrooj uninstall <name>` 快速管理插件。
- 在 管理域 -> 编辑域资料 处添加了语言选择的自动补全。
- 支持在 OI 赛制下查看自己已提交的代码。
- import-qduoj：支持导入 SPJ 题目。
- fps-importer：适配 FPS 文件 1.4 版本。
- 其他漏洞修复和体验优化。
- 支持使用 `ctx.i18n.load(lang, Record<string, string>)` 加载翻译文件。
- 支持 `ctx.withHandlerClass(name, callback)` 获取类原型。
- prom-client: 支持自定义 ConnectionHandler 上报分类。
- 将 Handler.ctx 移动至 Handler.context，新的 Handler.ctx 为 PluginContext。

</details>

## 开源许可

本项目中的 examples/ install/ packages/ui-default/ 下的内容仅采用 AGPL-3.0 进行授权。
项目其余部分使用双重许可：

1. 您可以在遵守 AGPL-3.0 许可证和下述附加条款章节的前提下免费使用这些代码：  
2. 如确需闭源，您也可以联系我们购买其他授权。

在您部署 Hydro 时，需要保留底部的 `Powered by Hydro` 字样，其中的 `Hydro` 字样需指向 `hydro.js.org/本仓库/fork` 之一的链接。  
若您对源码做出修改/扩展，同样需要以 AGPL-3.0-or-later 开源，您可以以 `Powered by Hydro, Modified by xxx` 格式在页脚注明。  

### 附加条款

1. 不可移除本项目的版权声明；（[AGPL3 7(b)](LICENSE#L356)）
2. 当重分发经修改后的本软件时，需要在软件名或版本号中采用可识别的方式进行注明；（[AGPL3 7(c)](LICENSE#L360)）

## 贡献代码

参照 [CONTRIBUTING.md](CONTRIBUTING.md)

## 鸣谢

排名不分先后，按照链接字典序  

- [Github](https://github.com/) 为 Hydro 提供了代码托管与自动构建。  
- [criyle](https://github.com/criyle) 提供评测沙箱实现。  
- [Vijos](https://github.com/vijos/vj4) 为 Hydro 提供了 UI 框架。  

## Sponsors

- [云斗学院](https://www.yundouxueyuan.com)
