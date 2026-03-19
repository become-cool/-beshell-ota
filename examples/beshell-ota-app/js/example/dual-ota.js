import * as ota from "ota"
import * as wifi from "wifi"
import * as flash from "flash"

// WiFi 配置
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"

// OTA 配置
const FIRMWARE_URL = "http://your-server/firmware.bin"
const FILESYSTEM_URL = "http://your-server/filesystem.bin"

async function main() {
    console.log("\n=== Dual OTA Update (Firmware + Filesystem) ===\n")
    
    // 1. 连接 WiFi
    console.log("Connecting to WiFi...")
    if (!await wifi.connect(WIFI_SSID, WIFI_PASS)) {
        console.log("Failed to connect to WiFi")
        return
    }
    
    let status = await wifi.waitIP()
    if (!status) {
        console.log("Failed to get IP address")
        return
    }
    console.log(`WiFi connected, IP: ${status.ip}`)
    console.log("")
    
    // 2. 获取分区信息
    let running = ota.getRunningPartition()
    let next = ota.getNextUpdatePartition()
    
    console.log("Current Status:")
    console.log(`  Running partition: ${running.label}`)
    console.log(`  Next partition: ${next.label}`)
    
    // 查找文件系统分区
    let fsPartitions = []
    let allParts = flash.allPartitions()
    for (let name in allParts) {
        if (name.startsWith("fsroot_")) {
            fsPartitions.push(allParts[name])
        }
    }
    
    console.log(`  Filesystem partitions: ${fsPartitions.map(p => p.label).join(", ")}`)
    console.log("")
    
    // 3. 执行双分区 OTA 升级
    console.log("Starting Dual OTA update...")
    console.log(`Firmware URL: ${FIRMWARE_URL}`)
    console.log(`Filesystem URL: ${FILESYSTEM_URL}`)
    console.log("")
    
    let startTime = Date.now()
    
    try {
        await ota.start({
            // 固件升级
            bin: {
                url: FIRMWARE_URL,
                // size: 1024000,
                // checksum: 0x12345678
            },
            // 文件系统升级
            fs: {
                url: FILESYSTEM_URL,
                partitions: fsPartitions,
                // size: 512000,
                // checksum: 0x87654321
            },
            step: 5,  // 每 5% 打印一次进度
            onProgress: (type, total, wrote) => {
                let percent = Math.round(wrote * 100 / total)
                let elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                process.stdout.write(`\r[${type.toUpperCase()}] ${percent}% | ${wrote}/${total} bytes | ${elapsed}s`)
            },
            onComplete: (type, error) => {
                console.log("")
                if (error) {
                    console.log(`❌ ${type.toUpperCase()} update failed: ${error.message}`)
                } else {
                    console.log(`✓ ${type.toUpperCase()} update completed`)
                }
            }
        })
        
        let duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`\n✓ Dual OTA completed in ${duration} seconds`)
        console.log("")
        console.log("Summary:")
        console.log(`  ✓ Firmware updated: ${next.label}`)
        console.log(`  ✓ Filesystem updated: ${fsPartitions.map(p => p.label).join(", ")}`)
        console.log("")
        console.log("The device will reboot to apply all updates.")
        console.log("Both firmware and filesystem will be switched to the new versions.")
        
    } catch (e) {
        console.log(`\n❌ OTA error: ${e.message}`)
        console.log("Some updates may have failed. Please check the logs above.")
    }
}

main()
