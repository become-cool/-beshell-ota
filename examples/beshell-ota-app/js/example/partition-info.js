import * as ota from "ota"
import * as flash from "flash"

async function main() {
    console.log("\n=== OTA Partition Information ===\n")
    
    // 获取启动分区
    let bootPartition = ota.getBootPartition()
    console.log("Boot Partition:")
    console.log(`  Label: ${bootPartition.label}`)
    console.log(`  Type: ${bootPartition.type}`)
    console.log(`  Subtype: ${bootPartition.subtype}`)
    console.log(`  Address: 0x${bootPartition.address.toString(16).toUpperCase()}`)
    console.log(`  Size: ${bootPartition.size} bytes (${(bootPartition.size / 1024).toFixed(2)} KB)`)
    console.log("")
    
    // 获取运行中的分区
    let runningPartition = ota.getRunningPartition()
    console.log("Running Partition:")
    console.log(`  Label: ${runningPartition.label}`)
    console.log(`  Type: ${runningPartition.type}`)
    console.log(`  Subtype: ${runningPartition.subtype}`)
    console.log(`  Address: 0x${runningPartition.address.toString(16).toUpperCase()}`)
    console.log(`  Size: ${runningPartition.size} bytes (${(runningPartition.size / 1024).toFixed(2)} KB)`)
    console.log("")
    
    // 获取下一个更新分区
    let nextPartition = ota.getNextUpdatePartition()
    console.log("Next Update Partition:")
    console.log(`  Label: ${nextPartition.label}`)
    console.log(`  Type: ${nextPartition.type}`)
    console.log(`  Subtype: ${nextPartition.subtype}`)
    console.log(`  Address: 0x${nextPartition.address.toString(16).toUpperCase()}`)
    console.log(`  Size: ${nextPartition.size} bytes (${(nextPartition.size / 1024).toFixed(2)} KB)`)
    console.log("")
    
    // 获取所有分区
    console.log("All Partitions:")
    let partitions = flash.allPartitions()
    for (let name in partitions) {
        let p = partitions[name]
        console.log(`  ${p.label}: 0x${p.address.toString(16).toUpperCase()} - ${p.size} bytes`)
    }
    console.log("")
    
    // 检查回滚是否启用
    let rollbackEnabled = ota.isRollbackEnabled()
    console.log(`Rollback Enabled: ${rollbackEnabled}`)
    console.log("")
    
    console.log("=== Partition Info Complete ===")
}

main()
