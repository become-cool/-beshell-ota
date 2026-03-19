import * as ota from "ota"
import * as wifi from "wifi"
import * as nvs from "nvs"

/**
 * 自动 OTA 示例
 * 
 * 开机时检查是否有新版本，如果有则自动下载并升级
 * 适用于需要自动更新的场景
 */

// WiFi 配置
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"

// OTA 配置
const VERSION_CHECK_URL = "http://your-server/version.json"
const FIRMWARE_BASE_URL = "http://your-server/firmware/"

// 检查间隔（毫秒）
const CHECK_INTERVAL = 24 * 60 * 60 * 1000  // 24 小时

async function checkForUpdate() {
    console.log("Checking for updates...")
    
    try {
        // 获取当前版本
        let currentVersion = nvs.readString("ota.version") || "0.0.0"
        console.log(`Current version: ${currentVersion}`)
        
        // 从服务器获取最新版本信息
        let response = await mg.get(VERSION_CHECK_URL)
        let versionInfo = JSON.parse(response.toString())
        
        console.log(`Latest version: ${versionInfo.version}`)
        
        // 比较版本
        if (compareVersions(versionInfo.version, currentVersion) > 0) {
            console.log(`New version available: ${versionInfo.version}`)
            return versionInfo
        } else {
            console.log("Already up to date")
            return null
        }
        
    } catch (e) {
        console.log(`Version check failed: ${e.message}`)
        return null
    }
}

async function performUpdate(versionInfo) {
    console.log("")
    console.log(`Starting update to version ${versionInfo.version}...`)
    
    let firmwareUrl = FIRMWARE_BASE_URL + versionInfo.filename
    
    try {
        await ota.start({
            bin: {
                url: firmwareUrl,
                size: versionInfo.size,
                checksum: parseInt(versionInfo.checksum, 16)
            },
            step: 10,
            onProgress: (type, total, wrote) => {
                let percent = Math.round(wrote * 100 / total)
                process.stdout.write(`\rProgress: ${percent}%`)
            },
            onComplete: (type, error) => {
                console.log("")
                if (error) {
                    console.log(`❌ Update failed: ${error.message}`)
                } else {
                    console.log(`✓ Update completed`)
                }
            }
        })
        
        // 保存新版本号
        nvs.writeString("ota.version", versionInfo.version)
        nvs.writeString("ota.updated_at", new Date().toISOString())
        
        console.log("")
        console.log("✓ Update successful!")
        console.log("Rebooting to apply new firmware...")
        
        // 延迟重启
        setTimeout(() => {
            reboot()
        }, 3000)
        
        return true
        
    } catch (e) {
        console.log(`\n❌ Update error: ${e.message}`)
        return false
    }
}

// 版本号比较
function compareVersions(v1, v2) {
    let parts1 = v1.split('.').map(Number)
    let parts2 = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        let p1 = parts1[i] || 0
        let p2 = parts2[i] || 0
        
        if (p1 > p2) return 1
        if (p1 < p2) return -1
    }
    
    return 0
}

async function main() {
    console.log("\n=== Auto OTA Example ===\n")
    
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
    
    // 2. 检查更新
    let versionInfo = await checkForUpdate()
    
    if (versionInfo) {
        // 执行更新
        let success = await performUpdate(versionInfo)
        
        if (!success) {
            console.log("")
            console.log("Update failed. Will retry on next check.")
            scheduleNextCheck()
        }
    } else {
        // 没有更新，安排下次检查
        scheduleNextCheck()
    }
}

function scheduleNextCheck() {
    console.log("")
    console.log(`Next check in ${CHECK_INTERVAL / 1000 / 60} minutes`)
    
    setTimeout(() => {
        main()
    }, CHECK_INTERVAL)
}

// 首次运行
main()
