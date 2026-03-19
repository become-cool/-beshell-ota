import * as fs from "fs"

let examples = fs.listDirSync("/example")
  .sort((a,b)=>a.localeCompare(b))
  .reduce((lst,filename)=>{
      return lst + `    run /example/${filename}\n`
  },'')


console.log(`
  ============================================
   BeShell-OTA Example App
  ============================================

  This is a demo for BeShell-OTA firmware update:
  
  * Partition Info   - Show OTA partition information
  * Basic OTA        - Simple firmware update from URL
  * OTA with Verify  - Update with checksum verification
  * Dual OTA         - Update both firmware and filesystem
  * Rollback         - Rollback to previous firmware
  * Mark Valid       - Mark current firmware as valid

  Available Examples:
  ${examples}
  
  Commands:
  * Enter \`ls /example\` to list all examples
  * Enter \`run <full example path>\` to run example
  * Enter \`reboot\` to restart
  * Enter \`help\` or \`?\` to list all commands
  * Enter JavaScript code to run in interactive mode
`)

console.log(`
  ============================================
   BeShell-OTA 固件升级示例程序
  ============================================

  本示例演示 BeShell-OTA 固件升级功能：
  
  * 分区信息    - 显示 OTA 分区信息
  * 基础 OTA    - 从 URL 简单升级固件
  * 验证升级    - 带校验和的升级
  * 双分区升级  - 同时升级固件和文件系统
  * 回滚        - 回滚到之前的固件
  * 标记有效    - 标记当前固件为有效

  可用示例：
  ${examples}
  
  命令：
  * 输入 \`ls /example\` 列出所有示例
  * 输入 \`run <完整路径>\` 运行示例
  * 输入 \`reboot\` 重启
  * 输入 \`help\` 或 \`?\` 列出所有命令
  * 输入 JavaScript 代码进入交互模式
`)
