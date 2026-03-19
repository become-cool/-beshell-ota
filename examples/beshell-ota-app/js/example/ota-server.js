import * as mg from "mg"
import * as ota from "ota"

/**
 * OTA 服务器示例
 * 
 * 创建一个简单的 HTTP 服务器，接收固件上传并执行 OTA 升级
 * 适用于局域网内的固件更新
 */

const SERVER_PORT = 8080

async function main() {
    console.log("\n=== OTA Server Example ===\n")
    
    // 显示当前分区信息
    let running = ota.getRunningPartition()
    let next = ota.getNextUpdatePartition()
    
    console.log("Current Status:")
    console.log(`  Running partition: ${running.label}`)
    console.log(`  Next partition: ${next.label} (${(next.size / 1024).toFixed(2)} KB available)`)
    console.log("")
    
    // 创建 HTTP 服务器
    console.log(`Starting OTA server on port ${SERVER_PORT}...`)
    console.log("")
    console.log("Usage:")
    console.log(`  curl -X POST -F "firmware=@firmware.bin" http://<device-ip>:${SERVER_PORT}/ota`)
    console.log("")
    
    let isUpdating = false
    
    mg.listenHttp(`0.0.0.0:${SERVER_PORT}`, async (event, req, rspn) => {
        if (event !== "http.msg") return
        
        let url = req.url()
        let method = req.method()
        
        // 根路径 - 显示状态
        if (url === "/" && method === "GET") {
            let running = ota.getRunningPartition()
            let next = ota.getNextUpdatePartition()
            
            rspn.setStatus(200)
            rspn.setHeader("Content-Type", "application/json")
            rspn.send(JSON.stringify({
                status: "ok",
                running_partition: running.label,
                next_partition: next.label,
                next_partition_size: next.size,
                is_updating: isUpdating
            }, null, 2))
        }
        
        // OTA 升级接口
        else if (url === "/ota" && method === "POST") {
            if (isUpdating) {
                rspn.setStatus(409)
                rspn.setHeader("Content-Type", "application/json")
                rspn.send(JSON.stringify({
                    error: "OTA already in progress"
                }))
                return
            }
            
            // 获取请求体
            let body = req.body()
            if (!body || body.byteLength === 0) {
                rspn.setStatus(400)
                rspn.setHeader("Content-Type", "application/json")
                rspn.send(JSON.stringify({
                    error: "No firmware data received"
                }))
                return
            }
            
            console.log(`Received firmware: ${body.byteLength} bytes`)
            
            // 检查大小
            let next = ota.getNextUpdatePartition()
            if (body.byteLength > next.size) {
                rspn.setStatus(413)
                rspn.setHeader("Content-Type", "application/json")
                rspn.send(JSON.stringify({
                    error: "Firmware too large",
                    max_size: next.size
                }))
                return
            }
            
            isUpdating = true
            
            try {
                // 写入固件到分区
                console.log("Writing firmware to partition...")
                next.erase(0, next.size)
                
                // 按 16 字节对齐写入
                let data = new Uint8Array(body)
                let writeLen = Math.floor(data.length / 16) * 16
                if (writeLen > 0) {
                    next.write(0, data.slice(0, writeLen).buffer)
                }
                
                // 处理剩余数据
                let remaining = data.slice(writeLen)
                if (remaining.length > 0) {
                    let padLen = (16 - (remaining.length % 16)) % 16
                    let padded = new Uint8Array(remaining.length + padLen)
                    padded.set(remaining, 0)
                    next.write(writeLen, padded.buffer)
                }
                
                // 设置启动分区
                ota.setBootPartition(next)
                
                console.log("✓ OTA completed successfully!")
                
                rspn.setStatus(200)
                rspn.setHeader("Content-Type", "application/json")
                rspn.send(JSON.stringify({
                    success: true,
                    message: "OTA completed. Reboot to apply.",
                    new_partition: next.label
                }))
                
            } catch (e) {
                console.log(`❌ OTA failed: ${e.message}`)
                
                rspn.setStatus(500)
                rspn.setHeader("Content-Type", "application/json")
                rspn.send(JSON.stringify({
                    error: e.message
                }))
            }
            
            isUpdating = false
        }
        
        // 重启接口
        else if (url === "/reboot" && method === "POST") {
            rspn.setStatus(200)
            rspn.setHeader("Content-Type", "application/json")
            rspn.send(JSON.stringify({
                message: "Rebooting..."
            }))
            
            setTimeout(() => {
                reboot()
            }, 1000)
        }
        
        // 404
        else {
            rspn.setStatus(404)
            rspn.setHeader("Content-Type", "application/json")
            rspn.send(JSON.stringify({
                error: "Not found"
            }))
        }
    })
    
    console.log("✓ OTA server started!")
    console.log("")
    console.log("Available endpoints:")
    console.log(`  GET  /        - Get device status`)
    console.log(`  POST /ota     - Upload firmware (multipart/form-data)`)
    console.log(`  POST /reboot  - Reboot device`)
    console.log("")
    console.log("Press Ctrl+C to stop")
}

main()
