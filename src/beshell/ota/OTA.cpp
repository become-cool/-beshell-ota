#include "OTA.hpp"
#include "ota.hpp"
#include <beshell/quickjs.h>
#include <beshell/ModuleLoader.hpp>
#include <beshell/module/Flash.hpp>
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "esp_https_ota.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include <esp_wifi.h>
#include <lwip/dns.h>
#include <lwip/sockets.h>
#include <esp_netif.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "./js/ota.c"
#include "esp_ota_ops.h"

typedef struct OTAEvent {
    int ev ;
    int value ;
} OTAEvent_t;

/**
 * OTA (Over-The-Air) 模块用于 ESP32 设备的固件无线升级。
 * 
 * ## 双分区升级方案
 * 
 * BeShell OTA 采用独特的**双固件双分区**设计，将 C++ 固件和 JavaScript 固件分离管理，共使用四个分区：
 * 
 * ### 分区结构
 * 
 * | 分区 | 说明 | 用途 |
 * |------|------|------|
 * | **ota_0** | C++ 固件分区 A | 存储主固件或备用固件 |
 * | **ota_1** | C++ 固件分区 B | 存储主固件或备用固件 |
 * | **fs_0** | JS 固件分区 A | 存储 JavaScript 文件系统 |
 * | **fs_1** | JS 固件分区 B | 存储 JavaScript 文件系统 |
 * 
 * ### 升级模式
 * 
 * 1. **C++ 固件升级 (bin)**
 *    - 使用 ota_0 / ota_1 两个分区进行交替升级
 *    - 支持回滚机制，新固件异常时可恢复旧版本
 * 
 * 2. **JS 固件升级 (fs)**
 *    - 使用 fs_0 / fs_1 两个分区进行交替升级
 *    - 可独立升级，无需更新 C++ 侧
 * 
 * 3. **联合升级 (bin + fs)**
 *    - 同时升级 C++ 和 JS 固件
 *    - 确保版本兼容性
 * 
 * ### 方案优势
 * 
 * - **独立升级**：C++ 侧和 JS 业务逻辑可分别升级，减少更新包大小
 * - **快速迭代**：JS 侧更新无需重新编译 C++ 固件，加速开发流程
 * - **安全可靠**：双分区设计确保升级失败时可回滚，设备不会变砖
 * - **灵活部署**：支持仅更新业务逻辑（JS）或完整固件（C++ + JS）
 * 
 * ### 校验和算法
 * 
 * OTA 升级支持使用校验和验证固件完整性。校验和采用**简单累加算法**：将指定范围内所有字节的值相加，得到一个 32 位无符号整数校验值。
 * 
 * 详细算法说明参见 [Partition.checksum()](../flash.html#方法-checksum) 方法文档。
 * 
 * 示例：
 * ```javascript
 * import * as ota from "ota"
 * import * as flash from "flash"
 * 
 * // 获取当前运行的分区
 * const running = ota.getRunningPartition()
 * console.log("Running partition:", running.label)
 * 
 * // 获取下一个可用于更新的分区
 * const next = ota.getNextUpdatePartition()
 * console.log("Next update partition:", next.label)
 * 
 * // 执行 OTA 升级
 * await ota.start({
 *     bin: {
 *         url: "http://example.com/firmware.bin",
 *         size: 1048576,
 *         checksum: 0x12345678
 *     }
 * })
 * 
 * // 标记固件有效（重启后不再回滚）
 * ota.markValid()
 * ```
 *
 * @component beshell-ota
 * @module ota
 */


namespace be{

    char const * const OTA::name = "ota" ;

    static const char * runningFSPart = nullptr ;

    OTA::OTA(JSContext * ctx, const char * name)
        : EventModule(ctx, name, 0)
    {
        exportName("start") ;
        exportName("rollback") ;
        exportName("commit") ;

        EXPORT_FUNCTION(getBootPartition)
        EXPORT_FUNCTION(setBootPartition)
        EXPORT_FUNCTION(getRunningPartition)
        EXPORT_FUNCTION(getNextUpdatePartition)
        EXPORT_FUNCTION(markValid)
        EXPORT_FUNCTION(markInvalid)
        EXPORT_FUNCTION(isRollbackEnabled)
    }

    void OTA::use(be::BeShell * beshell) {
        beshell->use<be::NVS>() ;
        beshell->use<be::Flash>() ;
    }

    void OTA::exports(JSContext *ctx) {
        JSEngineEvalEmbeded(ctx, ota)
    }

    /**
     * 获取启动分区
     * 
     * 返回设备启动时使用的分区（即下次启动将使用的分区）。
     * 注意：这可能与当前运行的分区不同。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * const bootPart = ota.getBootPartition()
     * console.log("Boot partition:", bootPart.label)
     * console.log("Type:", bootPart.type)
     * console.log("Size:", bootPart.size)
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function getBootPartition
     * @return [Partition](Partition.html) 启动分区对象
     * @throws 获取启动分区失败
     */
    JSValue OTA::getBootPartition(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        const esp_partition_t * partition = esp_ota_get_boot_partition() ;
        if(!partition) {
            JSTHROW("get boot partition failed")
        }
        auto p = new Partition(partition, ctx) ;
        return p->jsobj ;
    }

    /**
     * 设置启动分区
     * 
     * 设置设备下次启动时使用的分区。通常用于 OTA 升级完成后切换到新固件分区。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 获取下一个更新分区
     * const nextPart = ota.getNextUpdatePartition()
     * 
     * // 写入固件数据到该分区后，设置为启动分区
     * // ... 写入固件代码 ...
     * 
     * // 设置为下次启动分区
     * ota.setBootPartition(nextPart)
     * console.log("Next boot will use:", nextPart.label)
     * 
     * // 重启设备
     * import * as process from "process"
     * process.restart()
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function setBootPartition
     * @param partition:[Partition](Partition.html) 要设置为启动的分区对象
     * @return undefined
     * @throws 参数必须是分区对象
     * @throws 设置启动分区失败
     */
    JSValue OTA::setBootPartition(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        CHECK_ARGC(1)
        if(!JS_IsObject(argv[0])) {
            JSTHROW("argument must be a partition object")
        }
        JSVALUE_TO_NCLASS(Partition, argv[0], partition)
        esp_err_t err = esp_ota_set_boot_partition(partition->partition) ;
        if(err!=ESP_OK) {
            JSTHROW("set boot partition failed: %d", err)
        }
        return JS_UNDEFINED ;
    }

    /**
     * 获取当前运行的分区
     * 
     * 返回当前正在运行的应用程序分区或文件系统分区。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 获取当前运行的应用程序分区
     * const runningApp = ota.getRunningPartition()
     * console.log("Running app partition:", runningApp.label)
     * 
     * // 获取当前运行的文件系统分区
     * const runningFS = ota.getRunningPartition("fs")
     * console.log("Running FS partition:", runningFS.label)
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function getRunningPartition
     * @param type:string="bin" 分区类型，"bin" 表示应用程序分区，"fs" 表示文件系统分区
     * @return [Partition](Partition.html) 当前运行的分区对象
     * @throws 无效的类型参数（必须是 'bin' 或 'fs'）
     * @throws 获取运行分区失败
     */
    JSValue OTA::getRunningPartition(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        const char* type = "bin";
        
        if (argc > 0 && JS_IsString(argv[0])) {
            const char* typeArg = JS_ToCString(ctx, argv[0]);
            if (typeArg) {
                if (strcmp(typeArg, "bin") == 0 || strcmp(typeArg, "fs") == 0) {
                    type = typeArg;
                } else {
                    JS_FreeCString(ctx, typeArg);
                    JSTHROW("Invalid type. Must be 'bin' or 'fs'");
                }
            }
        }

        if (strcmp(type, "bin") == 0) {
            const esp_partition_t* partition = esp_ota_get_running_partition();
            if (!partition) {
                if (argc > 0 && JS_IsString(argv[0])) {
                    JS_FreeCString(ctx, type);
                }
                JSTHROW("get running partition failed");
            }
            auto p = new Partition(partition, ctx);
            if (argc > 0 && JS_IsString(argv[0])) {
                JS_FreeCString(ctx, type);
            }
            return p->jsobj;
        } else { // type == "fs"
            char buff[128];
                const esp_partition_t* partition = esp_partition_find_first(ESP_PARTITION_TYPE_ANY, ESP_PARTITION_SUBTYPE_ANY, runningFSPart);
                if (!partition) {
                    if (argc > 0 && JS_IsString(argv[0])) {
                        JS_FreeCString(ctx, type);
                    }
                    JSTHROW("get running fs partition failed");
                }
                auto p = new Partition(partition, ctx);
                if (argc > 0 && JS_IsString(argv[0])) {
                    JS_FreeCString(ctx, type);
                }
                return p->jsobj;
        }
    }

    /**
     * 获取下一个可用于更新的分区
     * 
     * 返回 OTA 升级时应该写入固件的目标分区。通常是当前运行分区的另一个 OTA 分区。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 获取下一个更新分区
     * const nextPart = ota.getNextUpdatePartition()
     * console.log("Next update partition:", nextPart.label)
     * 
     * // 先擦除该分区
     * nextPart.erase(0, nextPart.size)
     * 
     * // 写入新固件数据
     * nextPart.write(0, firmwareData)
     * 
     * // 设置为启动分区
     * ota.setBootPartition(nextPart)
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function getNextUpdatePartition
     * @return [Partition](Partition.html) 下一个可用于更新的分区对象
     * @throws 获取更新分区失败
     */
    JSValue OTA::getNextUpdatePartition(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        const esp_partition_t * partition = esp_ota_get_next_update_partition(NULL) ;
        if(!partition) {
            JSTHROW("get running partition failed")
        }
        auto p = new Partition(partition, ctx) ;
        return p->jsobj ;
    }

    /**
     * 标记当前固件为有效
     * 
     * 取消回滚机制，标记当前运行的固件为有效。调用后，设备重启后将不再回滚到之前的固件版本。
     * 应在确认新固件运行正常后调用。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 执行 OTA 升级后
     * await ota.start({
     *     bin: { url: "http://example.com/firmware.bin" }
     * })
     * 
     * // 设备重启并运行新固件后，验证功能正常
     * // ... 验证代码 ...
     * 
     * // 标记固件有效，防止回滚
     * ota.markValid()
     * console.log("Firmware marked as valid")
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function markValid
     * @return undefined
     * @throws 标记有效失败
     */
    JSValue OTA::markValid(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        NVS::writeString("fsroot.boot", runningFSPart) ;
        esp_err_t err = esp_ota_mark_app_valid_cancel_rollback() ;
        if(err!=ESP_OK) {
            JSTHROW("mark valid failed: %d", err)
        }
        return JS_UNDEFINED ;
    }
    /**
     * 标记当前固件为无效并重启
     * 
     * 标记当前运行的固件为无效，并立即重启设备。重启后将回滚到之前的固件版本。
     * 应在新固件运行异常时调用。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 尝试连接服务器验证固件
     * try {
     *     const response = await fetch("http://server/health")
     *     if (!response.ok) {
     *         throw new Error("Health check failed")
     *     }
     * } catch(e) {
     *     console.error("Firmware validation failed, rolling back...")
     *     ota.markInvalid()  // 这将标记固件无效并重启
     * }
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function markInvalid
     * @return undefined
     * @throws 标记无效失败
     */
    JSValue OTA::markInvalid(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        esp_err_t err = esp_ota_mark_app_invalid_rollback_and_reboot() ;
        if(err!=ESP_OK) {
            JSTHROW("mark valid failed: %d", err)
        }
        return JS_UNDEFINED ;
    }

    /**
     * 检查是否启用了回滚功能
     * 
     * 返回设备是否启用了固件回滚功能。需要在编译配置中启用 CONFIG_APP_ROLLBACK_ENABLE。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * if (ota.isRollbackEnabled()) {
     *     console.log("Rollback is enabled")
     * } else {
     *     console.log("Rollback is not enabled")
     * }
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function isRollbackEnabled
     * @return bool 是否启用回滚功能
     */
    JSValue OTA::isRollbackEnabled(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
        #if CONFIG_APP_ROLLBACK_ENABLE
            return JS_TRUE ;
        #else
            return JS_FALSE ;
        #endif
    }

    const char * OTA::whichFS(const char * fsPartName) {
        static char buff[128] ;
        if( NVS::readString("fsroot.boot.try", buff, sizeof(buff))==ESP_OK ) {
            NVS::erase("fsroot.boot.try") ;
        }
        else if( NVS::readString("fsroot.boot", buff, sizeof(buff))==ESP_OK ) {
            runningFSPart = buff ;
        }
        else {
            runningFSPart = fsPartName ;
        }
        return runningFSPart ;
    }

    // ============================================================================
    // 以下函数在 js/ota.js 中实现，通过 exportValue 导出到 ota 模块
    // ============================================================================

    /**
     * 启动 OTA 升级
     * 
     * 从指定的 URL 下载固件并写入到 OTA 分区。支持应用程序固件（bin）和文件系统（fs）的独立升级。
     * 
     * > 如果需要做校验，可使用 checksum 属性，计算方法参考： [Partition.checksum()](../flash.html#方法-checksum) ，ota 会在下载完成后自动验证校验和，如果不匹配将抛出错误。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * // 基本用法 - 只升级应用程序
     * await ota.start({
     *     bin: {
     *         url: "http://example.com/firmware.bin",
     *         size: 1048576,
     *         checksum: 0x12345678
     *     }
     * })
     * 
     * // 同时升级应用程序和文件系统
     * await ota.start({
     *     bin: {
     *         url: "http://example.com/firmware.bin",
     *         size: 1048576
     *     },
     *     fs: {
     *         url: "http://example.com/fs.bin",
     *         size: 2097152
     *     }
     * })
     * 
     * // 带进度回调
     * await ota.start({
     *     bin: {
     *         url: "http://example.com/firmware.bin",
     *         size: 1048576
     *     },
     *     onProgress: (type, total, wrote) => {
     *         const percent = Math.round(wrote * 100 / total)
     *         console.log(`${type}: ${percent}%`)
     *     },
     *     onComplete: (type, error) => {
     *         if (error) {
     *             console.error(`${type} upgrade failed:`, error)
     *         } else {
     *             console.log(`${type} upgrade completed`)
     *         }
     *     }
     * })
     * 
     * // 自定义下载器
     * await ota.start({
     *     bin: {
     *         url: "https://example.com/firmware.bin"
     *     },
     *     downloader: async (url, localpath, callback) => {
     *         // 自定义下载逻辑
     *         // callback(total, wrote, chunk)
     *     }
     * })
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function start
     * @param opt:object 升级选项
     *     {
     *         bin?: {
     *             url: string,         // 固件下载 URL
     *             size: number,        // 固件大小（字节）
     *             checksum?: number,   // 固件校验和
     *             partitions?: string[] // 目标分区列表，自动检测
     *         },
     *         fs?: {
     *             url: string,         // 文件系统下载 URL
     *             size: number,        // 文件系统大小（字节）
     *             checksum?: number,   // 文件系统校验和
     *             partitions?: string[] // 目标分区列表，自动检测
     *         },
     *         onProgress?: (type: string, total: number, wrote: number) => void, // 进度回调
     *         onComplete?: (type: string, error: Error | null) => void, // 完成回调
     *         downloader?: (url: string, localpath: string, callback: Function) => Promise<void>, // 自定义下载器
     *         step?: number          // 进度打印步长（百分比），默认 5
     *     }
     * @return Promise\<undefined\>
     * @throws URL 未指定
     * @throws 未找到可用的 OTA 分区
     * @throws 校验和不匹配
     */

    /**
     * 回滚到之前的固件版本
     * 
     * 触发固件回滚，重启设备后将使用之前的固件版本启动。
     * 仅在启用了回滚功能时有效。
     * 
     * 示例：
     * ```javascript
     * import * as ota from "ota"
     * 
     * if (ota.isRollbackEnabled()) {
     *     console.log("Rolling back to previous version...")
     *     ota.rollback()
     * } else {
     *     console.log("Rollback is not enabled")
     * }
     * ```
     *
     * @module ota
     * @component beshell-ota
     * @function rollback
     * @return undefined
     */

    /**
     * 提交固件升级（别名）
     * 
     * markValid() 的别名，用于标记当前固件为有效。
     * 
     * @module ota
     * @component beshell-ota
     * @function commit
     * @return undefined
     * @see markValid
     */
}
