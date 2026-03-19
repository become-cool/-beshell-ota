# BeShell-OTA Example App

This is an example project demonstrating the usage of BeShell-OTA (Over-The-Air firmware update).

## Features

This example project demonstrates the following features:

### OTA Features

| Example File | Description |
|---------|------|
| `partition-info.js` | Show OTA partition information |
| `basic-ota.js` | Basic OTA update (from URL) |
| `ota-with-verify.js` | OTA with checksum verification |
| `dual-ota.js` | Dual partition update (firmware + filesystem) |
| `rollback.js` | Rollback to previous firmware |
| `mark-valid.js` | Mark current firmware as valid |
| `ota-server.js` | OTA server (receive firmware upload) |
| `auto-ota.js` | Auto OTA (check update on boot) |

## Project Structure

```
beshell-ota-app/
├── CMakeLists.txt          # Project CMake configuration
├── sdkconfig.defaults      # Default SDK configuration
├── README.md               # This file
├── main/
│   ├── main.cpp            # C++ entry file
│   ├── CMakeLists.txt      # main component CMake config
│   └── idf_component.yml   # Component dependencies
├── img/
│   ├── partitions-4MB.csv  # 4MB Flash partition table (OTA support)
│   ├── partitions-8MB.csv  # 8MB Flash partition table
│   └── partitions-16MB.csv # 16MB Flash partition table
└── js/
    ├── main.js             # JS entry file
    └── example/            # Example scripts directory
        ├── partition-info.js
        ├── basic-ota.js
        ├── ota-with-verify.js
        ├── dual-ota.js
        ├── rollback.js
        ├── mark-valid.js
        ├── ota-server.js
        └── auto-ota.js
```

## Hardware Requirements

- ESP32 / ESP32-S3 / ESP32-C3 or other chips
- At least 4MB Flash (8MB or more recommended)
- USB-to-Serial for flashing and debugging
- WiFi network connection

## Partition Table

OTA requires special partition table configuration with the following partitions:

| Partition | Type | Description |
|-----------|------|-------------|
| otadata | data | OTA data partition (stores boot info) |
| ota_0 | app | Firmware partition 0 |
| ota_1 | app | Firmware partition 1 (for update) |
| fsroot_0 | data | Filesystem partition 0 |
| fsroot_1 | data | Filesystem partition 1 (for update) |

## Quick Start

### 1. Configure WiFi

Edit example files and set your WiFi credentials:

```javascript
const WIFI_SSID = "your-ssid"
const WIFI_PASS = "your-password"
```

### 2. Configure OTA Server

Set the firmware download URL:

```javascript
const FIRMWARE_URL = "http://your-server/firmware.bin"
```

### 3. Build the Project

```bash
idf.py build
```

### 4. Flash the Firmware

```bash
idf.py flash
```

### 5. View Serial Output

```bash
idf.py monitor
```

### 6. Run Examples

In the serial terminal, enter the following command to run an example:

```
run /example/partition-info.js
```

## Example Details

### Show Partition Info

```javascript
import * as ota from "ota"

let bootPartition = ota.getBootPartition()
console.log("Boot partition:", bootPartition.label)

let runningPartition = ota.getRunningPartition()
console.log("Running partition:", runningPartition.label)

let nextPartition = ota.getNextUpdatePartition()
console.log("Next update partition:", nextPartition.label)
```

### Basic OTA Update

```javascript
import * as ota from "ota"

await ota.start({
    bin: {
        url: "http://server/firmware.bin"
    },
    onProgress: (type, total, wrote) => {
        let percent = Math.round(wrote * 100 / total)
        console.log(`Progress: ${percent}%`)
    }
})
```

### OTA with Verification

```javascript
await ota.start({
    bin: {
        url: "http://server/firmware.bin",
        size: 1024000,           // Expected size
        checksum: 0x12345678     // Expected checksum
    }
})
```

### Dual Partition Update (Firmware + Filesystem)

```javascript
await ota.start({
    bin: {
        url: "http://server/firmware.bin"
    },
    fs: {
        url: "http://server/filesystem.bin",
        partitions: [fsroot_0, fsroot_1]
    }
})
```

### Rollback Firmware

```javascript
// Mark current firmware as invalid, trigger rollback
ota.markInvalid()
// Device will automatically reboot and load previous firmware
```

### Mark Firmware Valid

```javascript
// After confirming new firmware works, mark as valid
ota.markValid()
```

## API Reference

### ota module

#### getBootPartition()
Get boot partition information.

#### getRunningPartition(type?)
Get currently running partition.
- `type`: "bin" | "fs", default is "bin"

#### getNextUpdatePartition()
Get next partition available for update.

#### setBootPartition(partition)
Set boot partition.

#### markValid()
Mark current firmware as valid (prevent rollback).

#### markInvalid()
Mark current firmware as invalid (trigger rollback).

#### isRollbackEnabled()
Check if rollback feature is enabled.

#### start(options)
Execute OTA update.
- `options.bin`: Firmware update options
  - `url`: Firmware download URL
  - `size`: Expected size (optional)
  - `checksum`: Expected checksum (optional)
- `options.fs`: Filesystem update options
  - `url`: Filesystem image URL
  - `partitions`: Target partition array
- `options.onProgress`: Progress callback function
- `options.onComplete`: Completion callback function

## Security Recommendations

1. **Use HTTPS**: Use HTTPS for firmware download in production
2. **Checksum Verification**: Always use checksum to verify firmware integrity
3. **Version Check**: Check version number before update to avoid redundant updates
4. **Rollback Mechanism**: Enable rollback feature to ensure recovery from failed updates
5. **Test Validation**: Verify new firmware works correctly before marking valid

## Dependencies

- [beshell](https://github.com/become-cool/beshell) - BeShell core framework
- [beshell-ota](https://github.com/become-cool/beshell-ota) - OTA component
- [beshell-mg](https://github.com/become-cool/beshell-mg) - Network component (for download)

## License

LGPL

## Links

- [BeShell Documentation](https://beshell.become.cool)
- [ESP-IDF OTA Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/api-reference/system/ota.html)
