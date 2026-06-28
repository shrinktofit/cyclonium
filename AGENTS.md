# Agent 编码指南

本文档为在此代码库中工作的 AI 代理提供编码规范和开发指南。

## 项目结构

这是一个使用 pnpm workspaces 和 lerna 管理的 monorepo。

```
packages/
├── cyclo-core/       # 核心框架
├── cyclo-math/       # 数学库 (Vec2, Mat3, etc)
├── cyclo-event/      # 事件系统
├── cyclo-algorithm/  # 算法
├── cyclo-physics-2d/ # 2D 物理引擎
├── cyclo-abort-controller/
├── cyclo-debug-draw/
├── workflow/        # 构建配置
└── ...
```

## 构建与测试命令

### 构建
```bash
# 构建所有包
pnpm build

# 构建单个包
cd packages/cyclo-math && pnpm build
```

### 测试
```bash
# 运行所有测试
cd packages/cyclo-math && pnpm test

# 运行单个测试文件
cd packages/cyclo-math && pnpm exec vitest run test/vec2.test.ts

# 运行单个测试用例
cd packages/cyclo-math && pnpm exec vitest run test/vec2.test.ts -t "should calculate magnitude"

# 监视模式
cd packages/cyclo-math && pnpm exec vitest
```

### 开发模式
```bash
# TypeScript 监视模式
cd packages/cyclo-core && pnpm dev
```

### 代码检查
```bash
# ESLint (必须在项目根目录运行)
pnpm exec eslint packages/cyclo-physics-2d/test/*.ts
```

### 依赖 Cocos 引擎的测试

部分包（如 `core`、`physics-2d`）的单元测试依赖 Cocos 引擎环境，需使用 vitest + Playwright 浏览器测试：

```bash
# 运行浏览器测试
cd packages/cyclo-physics-2d && pnpm test

# 需在 vitest.config.ts 中配置 browser provider 和 cc-test 插件:
# test: { browser: { provider: playwright({ ... }) } }
# plugins: [ ...ccTest() ]
```

## TypeScript 配置

- **目标**: ES2022
- **模块**: node20
- **严格模式**: 启用 (strict: true)
- **verbatimModuleSyntax**: 启用
- **noImplicitOverride**: 启用

```json
{
  "extends": "@cyclonium/workflow/tsconfig/lib",
  "compilerOptions": {
    "target": "es2022",
    "module": "node20",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noImplicitOverride": true
  }
}
```

## 代码风格规范

### 导入规范

- **必须**使用 `.js` 扩展名导入 (即使在 .ts 文件中):
  ```typescript
  import { Vec2 } from './vec2.js';        // 正确
  import { clone } from '@/vec2.js';       // 正确 (alias)
  import { clone } from './vec2';         // 错误
  ```

- **必须**使用路径别名 `@/`:
  ```typescript
  import { Vec2 } from '@/vec2.js';       // 正确
  import { clamp } from '../number.js';   // 避免
  ```

- 导入顺序: 外部库 → 内部模块 → 类型

### 命名规范

- **类**: PascalCase (`Vec2`, `EventEmitter`)
- **接口**: PascalCase，可加 `I` 前缀 (`IMatrix`, `Vec2`)
- **类型**: PascalCase
- **函数/方法**: camelCase
- **常量**: UPPER_SNAKE_CASE (运行时), PascalCase (静态属性)
- **文件**: kebab-case (`vec2.ts`, `event-emitter.ts`)

### 类型注解

- **必须**显式参数类型:
  ```typescript
  function multiply(v: Vec2, scalar: number): Vec2 { ... }
  ```

- 优先使用接口而非类型别名 (除非是联合/元组类型)

### 错误处理

- 使用 `Error` 子类处理业务错误
- 不捕获异常除非有明确目的
- 使用 `assert` 处理不可能的情况

### 类的最佳实践

- 使用 `static` 方法而非实例方法 (如 `Vec2.add(a, b)`)
- 常用静态实例使用 `Object.freeze()`:
  ```typescript
  static ZERO = Object.freeze(new Vec2());
  static UNIT_X = Object.freeze(new Vec2(1, 0));
  ```
- 使用 getter 计算派生属性:
  ```typescript
  get magnitude() {
    return Math.sqrt(this.magnitudeSquared);
  }
  ```

### 测试规范

- 测试文件放在 `test/*.test.ts`
- 使用 vitest + expect
- 使用 `describe`/`it` 组织测试
- 测试命名: "should [expected behavior]"
- **重要**: 写完单元测试后必须保证 `pnpm test` 通过，同时通过 ESLint 检查

```typescript
import { describe, it, expect } from 'vitest';
import { Vec2 } from '@/vec2.js';

describe('Vec2', () => {
  describe('magnitude', () => {
    it('should calculate magnitude', () => {
      const v = new Vec2(3, 4);
      expect(v.magnitude).toBeCloseTo(5);
    });
  });
});
```

### 代码格式化

- 使用 2 空格缩进
- 不使用分号
- 使用单引号
- 启用 ESLint 并修复所有警告

## 包结构模板

```
packages/[package-name]/
├── src/
│   ├── index.ts          # 主入口
│   ├── [module].ts       # 模块
│   └── export/           # 导出配置
├── test/
│   └── [module].test.ts  # 单元测试
├── lib/                  # 编译输出
├── package.json
├── tsconfig.json
└── vitest.config.ts      # 如有测试
```

### package.json 模板

```json
{
  "name": "@cyclonium/[package]",
  "version": "0.0.1",
  "type": "module",
  "files": ["lib/**/*{.js,.d.ts}"],
  "exports": {
    ".": "./lib/index.js"
  },
  "scripts": {
    "build": "pnpm exec tsc",
    "dev": "pnpm exec tsc --watch",
    "test": "pnpm exec vitest run"
  },
  "dependencies": {
    "@cyclonium/algorithm": "workspace:^"
  },
  "devDependencies": {
    "@cyclonium/workflow": "workspace:*",
    "vitest": "catalog:"
  }
}
```

## 常见操作

### 添加新包

1. 在 `packages/` 下创建目录结构
2. 配置 `tsconfig.json`:
   ```json
   {
     "extends": "@cyclonium/workflow/tsconfig/lib",
     "include": ["src"],
     "compilerOptions": {
       "rootDir": "src",
       "outDir": "lib"
     }
   }
   ```
3. 在 `package.json` 添加 workspace 依赖

### 添加导出

在 `package.json` 的 `exports` 字段添加映射:
```json
"exports": {
  "./utils": "./lib/utils.js",
  "./math/vec2": "./lib/math/vec2.js"
}
```
