import * as ota from "ota"
import * as wifi from "wifi"

// WiFi 配置
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"

// OTA 配置
const FIRMWARE_URL = "http://your-server/firmware.bin"

async function main() {
    console.log("\n=== Basic OTA Update Example ===\n")
    
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
    console.log("")
    
    // 3. 执行 OTA 升级
    console.log("Starting OTA update...")
    console.log(`Firmware URL: ${FIRMWARE_URL}`)
    console.log("")
    
    try {
        await ota.start({
            bin: {
                url: FIRMWARE_URL,
                // size: 123456,  // 可选：固件大小
                // checksum: 0xABCDEF  // 可选：校验和
            },
            onProgress: (type, total, wrote) => {
                let percent = Math.round(wrote * 100 / total)
                process.stdout.write(`\rProgress: ${percent}% (${wrote}/${total} bytes)`)
            },
            onComplete: (type, error) => {
                if (error) {
                    console.log(`\nOTA failed: ${error.message}`)
                } else {
                    console.log(`\nOTA ${type} completed successfully!`)
                }
            }
        })
        
        console.log("")
        console.log("OTA update finished!")
        console.log("The device will reboot to apply the new firmware.")
        console.log("")
        console.log("Do you want to reboot now? (y/n)")
        
        // 等待用户输入
        // 实际使用时可以通过串口命令或其他方式触发重启
        
    } catch (e) {
        console.log(`\nOTA error: ${e.message}`)
    }
}

main()
