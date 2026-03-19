import * as ota from "ota"
import * as wifi from "wifi"

// WiFi 配置
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"

// OTA 配置
const FIRMWARE_URL = "http://your-server/firmware.bin"
const EXPECTED_SIZE = 1024000  // 期望的固件大小（字节）
const EXPECTED_CHECKSUM = 0x12345678  // 期望的校验和

async function main() {
    console.log("\n=== OTA Update with Verification ===\n")
    
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
    
    // 2. 显示当前分区信息
    let running = ota.getRunningPartition()
    let next = ota.getNextUpdatePartition()
    console.log(`Current running partition: ${running.label}`)
    console.log(`Next update partition: ${next.label}`)
    console.log(`Next partition size: ${next.size} bytes`)
    console.log("")
    
    // 3. 检查固件大小是否适合
    if (EXPECTED_SIZE > next.size) {
        console.log(`Error: Firmware size (${EXPECTED_SIZE}) exceeds partition size (${next.size})`)
        return
    }
    
    // 4. 执行带验证的 OTA 升级
    console.log("Starting OTA update with verification...")
    console.log(`Firmware URL: ${FIRMWARE_URL}`)
    console.log(`Expected size: ${EXPECTED_SIZE} bytes`)
    console.log(`Expected checksum: 0x${EXPECTED_CHECKSUM.toString(16).toUpperCase()}`)
    console.log("")
    
    let startTime = Date.now()
    
    try {
        await ota.start({
            bin: {
                url: FIRMWARE_URL,
                size: EXPECTED_SIZE,
                checksum: EXPECTED_CHECKSUM
            },
            step: 10,  // 每 10% 打印一次进度
            onProgress: (type, total, wrote) => {
                let percent = Math.round(wrote * 100 / total)
                let speed = (wrote / 1024 / ((Date.now() - startTime) / 1000)).toFixed(2)
                process.stdout.write(`\r[${type}] Progress: ${percent}% | Speed: ${speed} KB/s | ${wrote}/${total} bytes`)
            },
            onComplete: (type, error) => {
                console.log("")  // 换行
                if (error) {
                    console.log(`❌ OTA ${type} failed: ${error.message}`)
                } else {
                    console.log(`✓ OTA ${type} completed successfully!`)
                }
            }
        })
        
        let duration = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log(`\nTotal time: ${duration} seconds`)
        console.log("")
        console.log("✓ OTA update finished successfully!")
        console.log("✓ Checksum verification passed!")
        console.log("")
        console.log("The device will reboot to apply the new firmware.")
        console.log("After reboot, the new firmware will be tested.")
        console.log("If it fails, the system will automatically rollback.")
        
    } catch (e) {
        console.log(`\n❌ OTA error: ${e.message}`)
        console.log("The firmware was not updated.")
    }
}

main()
