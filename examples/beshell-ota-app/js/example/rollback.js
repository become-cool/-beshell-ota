import * as ota from "ota"

async function main() {
    console.log("\n=== OTA Rollback Example ===\n")
    
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
        console.log("⚠ Warning: Rollback is not enabled in sdkconfig!")
        console.log("To enable rollback, set CONFIG_APP_ROLLBACK_ENABLE=y")
        console.log("")
    }
    
    // 3. 执行回滚
    console.log("")
    console.log("Executing rollback...")
    console.log("This will switch to the previous firmware version.")
    console.log("")
    
    try {
        // 标记当前固件为无效，触发回滚
        ota.markInvalid()
        
        console.log("✓ Rollback triggered successfully!")
        console.log("")
        console.log("The device will reboot and load the previous firmware.")
        console.log("If the previous firmware works correctly, it will be marked as valid.")
        
    } catch (e) {
        console.log(`❌ Rollback failed: ${e.message}`)
        console.log("")
        console.log("Note: markInvalid() will reboot the device automatically.")
        console.log("If you see this error, the reboot may have been interrupted.")
    }
}

main()
