#include <stdio.h>
#include <beshell/BeShell.hpp>
#include <beshell-ota/OTA.hpp>

using namespace std ;
using namespace be ;


#ifdef __cplusplus
extern "C" {
#endif

void app_main(void)
{
    BeShell beshell;

    // 启用 BeShell 模块
    beshell.use<FS>() ;
    beshell.use<Serial>() ;
    beshell.use<NVS>() ;
    beshell.use<WiFi>() ;
    
    // 启用 OTA 模块
    beshell.use<OTA>() ;

    // 挂载 js 分区到文件的根目录
    FS::mount("/", new LittleFS("js", true)) ;

    // 启动 BeShell
    beshell.main("/main.js");
}

#ifdef __cplusplus
}
#endif
