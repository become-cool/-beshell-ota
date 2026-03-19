import * as ota from "ota"

async function main() {
    console.log("\n=== Mark Firmware as Valid ===\n")
    
    // 1. 显示当前分区信息
    let bootPartition = ota.getBootPartition()
    let runningPartition = ota.getRunningPartition()
    
    console.log("Current Status:")
    console.log(`  Boot partition: ${bootPartition.label}`)
    console.log(`  Running partition: ${runningPartition.label}`)
    console.log("")
    
    // 2. 检查回滚是否启用
    let rollbackEnabled = ota.isRollbackEnabled()
    console.log(`Rollback enabled: ${rollbackEnabled}`)
    
    if (!rollbackEnabled) {
        console.log("")
        console.log("ℹ Note: Rollback is not enabled, marking valid is not necessary.")
        console.log("The firmware is always considered valid when rollback is disabled.")
        return
    }
    
    // 3. 标记固件为有效
    console.log("")
    console.log("Marking current firmware as valid...")
    console.log("This will prevent automatic rollback on next boot.")
    console.log("")
    
    try {
        ota.markValid()
        
        console.log("✓ Firmware marked as valid successfully!")
        console.log("")
        console.log("The current firmware is now the 'golden' firmware.")
        console.log("If future updates fail, the system will rollback to this version.")
        
    } catch (e) {
        console.log(`❌ Failed to mark valid: ${e.message}`)
    }
}

main()
