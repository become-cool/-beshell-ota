# BeShell-OTA Example App

这是一个演示 BeShell-OTA (固件空中升级) 用法的示例工程。

## 功能特性

本示例工程演示了以下功能：

### OTA 功能

| 示例文件 | 说明 |
|---------|------|
| `partition-info.js` | 显示 OTA 分区信息 |
| `basic-ota.js` | 基础 OTA 升级（从 URL） |
| `ota-with-verify.js` | 带校验和验证的 OTA 升级 |
| `dual-ota.js` | 双分区升级（固件 + 文件系统） |
| `rollback.js` | 回滚到之前的固件版本 |
| `mark-valid.js` | 标记当前固件为有效 |
| `ota-server.js` | OTA 服务器（接收固件上传） |
| `auto-ota.js` | 自动 OTA（开机检查更新） |

## 项目结构

```
beshell-ota-app/
├── CMakeLists.txt          # 项目 CMake 配置
├── sdkconfig.defaults      # 默认 SDK 配置
├── README.md               # 本文件
├── main/
│   ├── main.cpp            # C++ 入口文件
│   ├── CMakeLists.txt      # main 组件 CMake 配置
│   └── idf_component.yml   # 组件依赖配置
├── img/
│   ├── partitions-4MB.csv  # 4MB Flash 分区表（支持 OTA）
│   ├── partitions-8MB.csv  # 8MB Flash 分区表
│   └── partitions-16MB.csv # 16MB Flash 分区表
└── js/
    ├── main.js             # JS 入口文件
    └── example/            # 示例脚本目录
        ├── partition-info.js
        ├── basic-ota.js
        ├── ota-with-verify.js
        ├── dual-ota.js
        ├── rollback.js
        ├── mark-valid.js
        ├── ota-server.js
        └── auto-ota.js
```

## 硬件要求

- ESP32 / ESP32-S3 / ESP32-C3 等芯片
- 至少 4MB Flash（推荐 8MB 或更多）
- USB 转串口用于烧录和调试
- WiFi 网络连接

## 分区表说明

OTA 需要特殊的分区表配置，包含以下分区：

| 分区名 | 类型 | 说明 |
|--------|------|------|
| otadata | data | OTA 数据分区（存储启动信息） |
| ota_0 | app | 固件分区 0 |
| ota_1 | app | 固件分区 1（用于升级） |
| fsroot_0 | data | 文件系统分区 0 |
| fsroot_1 | data | 文件系统分区 1（用于升级） |

## 快速开始

### 1. 配置 WiFi

编辑示例文件，设置你的 WiFi 信息：

```javascript
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"
```

### 2. 配置 OTA 服务器

设置固件下载地址：

```javascript
const FIRMWARE_URL = "http://your-server/firmware.bin"
```

### 3. 构建项目

```bash
idf.py build
```

### 4. 烧录固件

```bash
idf.py flash
```

### 5. 查看串口输出

```bash
idf.py monitor
```

### 6. 运行示例

在串口终端中，输入以下命令运行示例：

```
run /example/partition-info.js
```

## 示例详解

### 显示分区信息

```javascript
import * as ota from "ota"

let bootPartition = ota.getBootPartition()
console.log("Boot partition:", bootPartition.label)

let runningPartition = ota.getRunningPartition()
console.log("Running partition:", runningPartition.label)

let nextPartition = ota.getNextUpdatePartition()
console.log("Next update partition:", nextPartition.label)
```

### 基础 OTA 升级

```javascript
import * as ota from "ota"

await ota.start({
    bin: {
        url: "http://server/firmware.bin"
    },
    onProgress: (type, total, wrote) => {
        let percent = Math.round(wrote * 100 / total)
        console.log(`Progress: ${percent}%`)
    }
})
```

### 带验证的 OTA

```javascript
await ota.start({
    bin: {
        url: "http://server/firmware.bin",
        size: 1024000,           // 期望大小
        checksum: 0x12345678     // 期望校验和
    }
})
```

### 双分区升级（固件 + 文件系统）

```javascript
await ota.start({
    bin: {
        url: "http://server/firmware.bin"
    },
    fs: {
        url: "http://server/filesystem.bin",
        partitions: [fsroot_0, fsroot_1]
    }
})
```

### 回滚固件

```javascript
// 标记当前固件为无效，触发回滚
ota.markInvalid()
// 设备会自动重启并加载之前的固件
```

### 标记固件有效

```javascript
// 确认新固件工作正常后，标记为有效
ota.markValid()
```

## API 参考

### ota 模块

#### getBootPartition()
获取启动分区信息。

#### getRunningPartition(type?)
获取当前运行的分区。
- `type`: "bin" | "fs"，默认为 "bin"

#### getNextUpdatePartition()
获取下一个可用于更新的分区。

#### setBootPartition(partition)
设置启动分区。

#### markValid()
标记当前固件为有效（防止回滚）。

#### markInvalid()
标记当前固件为无效（触发回滚）。

#### isRollbackEnabled()
检查回滚功能是否启用。

#### start(options)
执行 OTA 升级。
- `options.bin`: 固件升级选项
  - `url`: 固件下载地址
  - `size`: 期望大小（可选）
  - `checksum`: 期望校验和（可选）
- `options.fs`: 文件系统升级选项
  - `url`: 文件系统镜像地址
  - `partitions`: 目标分区数组
- `options.onProgress`: 进度回调函数
- `options.onComplete`: 完成回调函数

## 安全建议

1. **使用 HTTPS**: 生产环境应使用 HTTPS 下载固件
2. **校验和验证**: 始终使用校验和验证固件完整性
3. **版本检查**: 升级前检查版本号，避免重复升级
4. **回滚机制**: 启用回滚功能，确保升级失败可恢复
5. **测试验证**: 新固件启动后，验证功能正常再标记有效

## 依赖组件

- [beshell](https://github.com/become-cool/beshell) - BeShell 核心框架
- [beshell-ota](https://github.com/become-cool/beshell-ota) - OTA 组件
- [beshell-mg](https://github.com/become-cool/beshell-mg) - 网络组件（用于下载）

## 许可证

LGPL

## 相关链接

- [BeShell 文档](https://beshell.become.cool)
- [ESP-IDF OTA 文档](https://docs.espressif.com/projects/esp-idf/en/latest/api-reference/system/ota.html)
