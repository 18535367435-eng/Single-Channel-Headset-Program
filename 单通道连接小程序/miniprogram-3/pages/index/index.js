class DigitalFilter {
  constructor() {
    this.bandpassState = {
      x: [0, 0, 0],
      y: [0, 0, 0]
    }
    this.notchState = {
      x: [0, 0, 0],
      y: [0, 0, 0]
    }
  }

  reset() {
    this.bandpassState = {
      x: [0, 0, 0],
      y: [0, 0, 0]
    }
    this.notchState = {
      x: [0, 0, 0],
      y: [0, 0, 0]
    }
  }

  bandpassFilter(inputValue, lowCutFreq, highCutFreq, sampleRate) {
    const nyquist = sampleRate / 2
    const low = lowCutFreq / nyquist
    const high = highCutFreq / nyquist
    
    const alpha = 0.5 * Math.sin(2 * Math.PI * low) / (2 * Math.PI * low)
    const beta = 0.5 * Math.sin(2 * Math.PI * high) / (2 * Math.PI * high)
    
    const a0 = 1
    const a1 = -2 * alpha * Math.cos(2 * Math.PI * low)
    const a2 = alpha * alpha
    const b0 = 1
    const b1 = -2 * beta * Math.cos(2 * Math.PI * high)
    const b2 = beta * beta
    
    const state = this.bandpassState
    
    state.x[2] = state.x[1]
    state.x[1] = state.x[0]
    state.x[0] = inputValue
    
    state.y[2] = state.y[1]
    state.y[1] = state.y[0]
    
    let output = (b0 * state.x[0] + b1 * state.x[1] + b2 * state.x[2] 
                 - a1 * state.y[1] - a2 * state.y[2]) / a0
    
    state.y[0] = output
    
    return output
  }

  notchFilter(inputValue, centerFreq, bandwidth, sampleRate) {
    const nyquist = sampleRate / 2
    const w0 = 2 * Math.PI * centerFreq / sampleRate
    const Q = centerFreq / bandwidth
    
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = 1
    const b1 = -2 * Math.cos(w0)
    const b2 = 1
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha
    
    const state = this.notchState
    
    state.x[2] = state.x[1]
    state.x[1] = state.x[0]
    state.x[0] = inputValue
    
    state.y[2] = state.y[1]
    state.y[1] = state.y[0]
    
    let output = (b0 * state.x[0] + b1 * state.x[1] + b2 * state.x[2] 
                 - a1 * state.y[1] - a2 * state.y[2]) / a0
    
    state.y[0] = output
    
    return output
  }

  applyFilters(inputValue, sampleRate = 512) {
    let filteredValue = inputValue
    
    filteredValue = this.bandpassFilter(filteredValue, 20, 100, sampleRate)
    
    filteredValue = this.notchFilter(filteredValue, 50, 2, sampleRate)
    
    return filteredValue
  }
}

Page({
  data: {
    isScanning: false,
    devices: [],
    connectionStatus: '未连接',
    connectedDeviceId: '',
    characteristics: [],
    selectedCharacteristic: '',
    selectedServiceId: '',
    isToyConnected: false,
    
    targetDeviceName: 'TOY_BLE_66666666',
    targetCharacteristicUUID: 'FF01',
    
    bciDeviceName: 'BCI_BLE_CD380884',
    bciDeviceId: '',
    bciServiceId: '',
    bciCharacteristicId: 'f0001682-0451-4000-b000-000000000000',
    isBCIConnected: false,
    
    eegData: '',
    latestEEGValue: 0,
    formattedLatestEEGValue: '0.0000',
    
    threshold: 100,
    autoControlEnabled: false,
    lastCommandTime: 0,
    commandCooldown: 1000,
    
    showAdvanced: false
  },
  
  // 定义控制命令常量
  COMMANDS: {
    FORWARD: '31 01 00 30',
    STOP: '31 00 00 31'
  },
  
  // 发送停止命令
  sendStopCommand() {
    this.sendCommand(this.COMMANDS.STOP, '停止')
  },

  checkThresholdAndControl(eegValue) {
    const { autoControlEnabled, threshold, isToyConnected, lastCommandTime, commandCooldown } = this.data
    
    if (!autoControlEnabled || !isToyConnected) {
      return
    }
    
    const now = Date.now()
    const timeSinceLastCommand = now - lastCommandTime
    
    if (Math.abs(eegValue) > threshold) {
      if (timeSinceLastCommand >= commandCooldown) {
        console.log(`脑电值 ${eegValue.toFixed(4)} 超过阈值 ${threshold}, 发送启动指令`)
        this.sendCommand(this.COMMANDS.FORWARD, '自动启动')
        this.setData({
          lastCommandTime: now
        })
      }
    } else {
      if (timeSinceLastCommand >= commandCooldown) {
        console.log(`脑电值 ${eegValue.toFixed(4)} 低于阈值 ${threshold}, 发送停止指令`)
        this.sendCommand(this.COMMANDS.STOP, '自动停止')
        this.setData({
          lastCommandTime: now
        })
      }
    }
  },

  toggleAutoControl(e) {
    const { isToyConnected, isBCIConnected } = this.data
    
    if (!isToyConnected) {
      wx.showToast({
        title: '请先连接玩具设备',
        icon: 'error'
      })
      return
    }
    
    if (!isBCIConnected) {
      wx.showToast({
        title: '请先连接BCI设备',
        icon: 'error'
      })
      return
    }
    
    this.setData({
      autoControlEnabled: e.detail.value
    })
    
    if (e.detail.value) {
      wx.showToast({
        title: '自动控制已开启',
        icon: 'success'
      })
    } else {
      wx.showToast({
        title: '自动控制已关闭',
        icon: 'success'
      })
      this.sendStopCommand()
    }
  },

  onThresholdInput(e) {
    const value = parseFloat(e.detail.value)
    if (isNaN(value) || value < 0) {
      wx.showToast({
        title: '请输入有效的阈值',
        icon: 'error'
      })
      return
    }
    this.setData({
      threshold: value
    })
  },

  onLoad() {
    this.digitalFilter = new DigitalFilter()
    
    this.setData({
      devices: [],
      characteristics: [],
      eegData: '',
      latestEEGValue: 0,
      formattedLatestEEGValue: '0.0000'
    })
    
    this.testFilter()
  },

  testFilter() {
    console.log('开始测试滤波器...')
    
    const testValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    console.log('测试输入值:', testValues)
    
    const filteredValues = []
    testValues.forEach((value, index) => {
      const filtered = this.digitalFilter.applyFilters(value, 512)
      filteredValues.push(filtered)
      console.log(`测试 ${index + 1}: 输入=${value}, 输出=${filtered}`)
      
      if (isNaN(filtered)) {
        console.error(`警告: 滤波器输出为NaN! 输入值=${value}`)
      }
    })
    
    console.log('滤波器测试完成')
    console.log('所有输出值:', filteredValues)
    
    const hasNaN = filteredValues.some(v => isNaN(v))
    if (hasNaN) {
      console.error('滤波器测试失败: 存在NaN输出')
    } else {
      console.log('滤波器测试成功: 所有输出值正常')
    }
  },

  // 解析脑电数据
  parseEEGData(uint8Array) {
    try {
      // 检查数据包长度，至少需要5个字节（第3、4、5个字节是脑电数据）
      if (uint8Array.length < 5) {
        console.log('数据包长度不足，无法解析脑电数据')
        return null
      }

      // 提取第3、4、5个字节（索引2、3、4）
      const byte1 = uint8Array[2] // 第3个字节
      const byte2 = uint8Array[3] // 第4个字节
      const byte3 = uint8Array[4] // 第5个字节

      // 将三个字节转换为24位大端序整数
      const eegRawValue = (byte1 << 16) | (byte2 << 8) | byte3

      // 转换为有符号24位整数
      let eegSignedValue = eegRawValue
      if (eegRawValue > 0x7FFFFF) {
        eegSignedValue = eegRawValue - 0x1000000
      }

      // 乘以0.02235得到实际脑电数值
      const eegValue = eegSignedValue * 0.02235

      console.log(`脑电数据解析: 原始值=${eegRawValue}, 有符号值=${eegSignedValue}, 计算结果=${eegValue.toFixed(4)}`)
      
      return eegValue
    } catch (error) {
      console.error('解析脑电数据时出错:', error)
      return null
    }
  },






  // 初始化蓝牙适配器
  openBluetoothAdapter() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('蓝牙适配器初始化成功', res)
        wx.showToast({ title: '蓝牙初始化成功' })
        
        // 监听蓝牙连接状态变化
        this.onBluetoothDeviceFound()
        this.onBLEConnectionStateChange()
        this.onBLECharacteristicValueChange()
      },
      fail: (err) => {
        console.error('蓝牙适配器初始化失败', err)
        wx.showToast({
          title: '蓝牙初始化失败',
          icon: 'error'
        })
        if (err.errCode === 10001) {
          wx.showModal({
            title: '提示',
            content: '请打开手机蓝牙',
            showCancel: false
          })
        }
      }
    })
  },

  // 开始搜索蓝牙设备
  startBluetoothDevicesDiscovery() {
    if (this.data.isScanning) return
    
    // 清空设备列表
    this.setData({
      devices: []
    })
    
    wx.startBluetoothDevicesDiscovery({
      services: [], // 搜索所有服务的设备
      allowDuplicatesKey: false,
      success: (res) => {
        console.log('开始搜索设备', res)
        this.setData({
          isScanning: true
        })
        wx.showToast({ title: '开始搜索设备' })
        
        // 10秒后自动停止搜索
        setTimeout(() => {
          this.stopBluetoothDevicesDiscovery()
        }, 10000)
      },
      fail: (err) => {
        console.error('搜索设备失败', err)
        wx.showToast({
          title: '搜索失败',
          icon: 'error'
        })
      }
    })
  },

  // 停止搜索蓝牙设备
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery({
      success: (res) => {
        console.log('停止搜索设备', res)
        this.setData({
          isScanning: false
        })
      },
      fail: (err) => {
        console.error('停止搜索失败', err)
      }
    })
  },

  // 监听发现新设备
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      const devices = res.devices || []
      devices.forEach(device => {
        // 确保device对象存在
        if (!device) return;
        
        // 过滤重复设备
        const existingDeviceIndex = this.data.devices.findIndex(d => d.deviceId === device.deviceId)
        if (existingDeviceIndex === -1 && device.name) {
          // 只添加有名称的设备
          const newDevices = [...this.data.devices, device]
          this.setData({
            devices: newDevices
          })
          
          // 如果是目标玩具设备且未连接，则自动连接
          if (typeof device.name === 'string' && device.name === this.data.targetDeviceName && !this.data.isToyConnected) {
            console.log('发现目标玩具设备，准备自动连接', device)
            this.autoConnectToDevice(device.deviceId, device.name)
          }
        } else if (existingDeviceIndex !== -1) {
          // 更新已存在设备的信号强度
          const newDevices = [...this.data.devices]
          newDevices[existingDeviceIndex].RSSI = device.RSSI
          this.setData({
            devices: newDevices
          })
        }
      })
    })
  },
  
  // 自动连接玩具设备
  autoConnectToyDevice() {
    if (this.data.isToyConnected) {
      wx.showToast({
        title: '已连接玩具设备',
        icon: 'success'
      })
      return
    }
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    // 检查是否已发现目标设备
    const targetDevice = this.data.devices.find(device => device.name === this.data.targetDeviceName)
    if (targetDevice) {
      // 已发现则直接连接
      this.autoConnectToDevice(targetDevice.deviceId, targetDevice.name)
    } else {
      // 未发现则开始搜索
      wx.showLoading({ title: '正在搜索玩具设备...' })
      this.setData({
        devices: []
      })
      
      wx.startBluetoothDevicesDiscovery({
        services: [],
        allowDuplicatesKey: false,
        success: () => {
          this.setData({ isScanning: true })
          
          // 设置超时
          setTimeout(() => {
            if (!this.data.isToyConnected) {
              wx.hideLoading()
              this.stopBluetoothDevicesDiscovery()
              wx.showToast({
                title: '未找到玩具设备',
                icon: 'error'
              })
            }
          }, 10000)
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('搜索设备失败', err)
          wx.showToast({
            title: '搜索失败',
            icon: 'error'
          })
        }
      })
    }
  },
  
  // 自动连接到指定设备并选择FF01特征值
  autoConnectToDevice(deviceId, deviceName) {
    wx.showLoading({ title: '正在连接玩具设备...' })
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        console.log('连接玩具设备成功', res)
        this.setData({
          connectedDeviceId: deviceId,
          connectionStatus: `已连接: ${deviceName || '未知设备'}`
        })
        
        // 清空之前的特征值和服务信息
        this.setData({
          characteristics: [],
          services: [],
          selectedCharacteristic: '',
          selectedServiceId: ''
        })
        
        // 获取服务和特征值
        this.getBLEDeviceServices(deviceId)
      },
      fail: (err) => {
        console.error('连接玩具设备失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
      }
    })
  },

  // 监听连接状态变化
  onBLEConnectionStateChange() {
    wx.onBLEConnectionStateChange((res) => {
      console.log('连接状态变化', res)
      const { connected, deviceId } = res
      
      if (deviceId === this.data.connectedDeviceId) {
        if (connected) {
          this.setData({
            connectionStatus: '已连接'
          })
          // 连接成功后获取服务
          this.getBLEDeviceServices(deviceId)
        } else {
          this.setData({
            connectionStatus: '连接已断开',
            connectedDeviceId: '',
            characteristics: [],
            selectedCharacteristic: '',
            selectedServiceId: '',
            services: [],
            isToyConnected: false
          })
          wx.hideLoading()
        }
      }
    })
  },

  // 监听特征值变化（接收数据）
  onBLECharacteristicValueChange() {
    wx.onBLECharacteristicValueChange((res) => {
      // 添加空值检查
      if (!res || !res.value) {
        console.error('接收到无效的数据:', res)
        return
      }
      
      console.log('接收到数据', res)
      const { value, characteristicId } = res
      
      // 将ArrayBuffer转换为字符串
      let receivedText = ''
      
      try {
        // 转换为uint8数组
        const uint8Array = new Uint8Array(value)
        const dataLength = uint8Array.length
        
        // 检查是否为BCI设备数据，如果是则只显示十六进制
        const { bciCharacteristicId, isBCIConnected } = this.data
        
        let isBCIData = false
        if (isBCIConnected && characteristicId && 
            characteristicId.toLowerCase() === bciCharacteristicId.toLowerCase()) {
          // BCI设备数据，只显示十六进制格式
          receivedText = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join(' ')
          isBCIData = true
        } else {
          // 玩具设备数据，尝试解析为文本
          try {
            receivedText = this.arrayBufferToString(value)
            // 检查是否为可读文本（非控制字符且非全0）
            const hasReadableChars = receivedText.split('').some(char => char.charCodeAt(0) > 32)
            const hasNonZeroBytes = uint8Array.some(byte => byte !== 0)
            
            if (!hasReadableChars && hasNonZeroBytes) {
              // 如果不是可读文本，显示十六进制
              receivedText = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join(' ')
            }
          } catch (e) {
            // 如果解析失败，显示十六进制
            receivedText = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join(' ')
          }
        }
        

        
        if (isBCIData) {
          const eegValue = this.parseEEGData(uint8Array)
          if (eegValue !== null) {
            const filteredEEGValue = this.digitalFilter.applyFilters(eegValue, 512)
            
            const now = new Date()
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
            
            let currentEEGData = this.data.eegData || ''
            currentEEGData += `[${timeStr}] 脑电值: ${filteredEEGValue.toFixed(4)}\n`
            
            if (currentEEGData.length > 500) {
              currentEEGData = currentEEGData.substring(currentEEGData.length - 500)
            }
            
            this.setData({
              eegData: currentEEGData,
              latestEEGValue: filteredEEGValue,
              formattedLatestEEGValue: (typeof filteredEEGValue === 'number' && !isNaN(filteredEEGValue)) ? filteredEEGValue.toFixed(4) : '0.0000'
            })
            
            this.checkThresholdAndControl(filteredEEGValue)
          }
        }
        
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`

      } catch (e) {
        console.error('处理接收数据时出错:', e)
      }
    })
  },

  // 连接蓝牙设备
  connectDevice(e) {
    const { deviceId, deviceName } = e.currentTarget.dataset
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    wx.showLoading({ title: '正在连接...' })
    
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        console.log('连接设备成功', res)
        this.setData({
          connectedDeviceId: deviceId,
          connectionStatus: `已连接: ${deviceName || '未知设备'}`
        })
        wx.hideLoading()
        wx.showToast({ title: '连接成功' })
      },
      fail: (err) => {
        console.error('连接设备失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
      }
    })
  },

  // 获取设备服务
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('获取服务成功', res.services)
        const services = res.services || []
        this.setData({
          services: services
        })
        
        // 遍历所有服务获取特征值，添加空值检查
        services.forEach(service => {
          if (service && service.uuid) {
            this.getBLEDeviceCharacteristics(deviceId, service.uuid)
          }
        })
      },
      fail: (err) => {
        console.error('获取服务失败', err)
      }
    })
  },

  // 获取设备特征值
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('获取特征值成功', res.characteristics)
        const characteristics = res.characteristics || []
        
        // 添加特征值到列表，包含服务ID信息，添加空值检查
        const newCharacteristics = characteristics
          .filter(char => char)
          .map(char => ({
            ...char,
            serviceId
          }))
        
        const updatedCharacteristics = [...this.data.characteristics, ...newCharacteristics]
        this.setData({
          characteristics: updatedCharacteristics
        })
        
        // 标记是否找到FF01特征值
        let ff01CharacteristicFound = false
        
        // 对可读取的特征值进行订阅
        characteristics.forEach(characteristic => {
          if (!characteristic || !characteristic.properties) return;
          
          // 检查是否是FF01特征值
          const isFF01 = characteristic.uuid && typeof characteristic.uuid === 'string' &&
                       characteristic.uuid.indexOf(this.data.targetCharacteristicUUID) > -1
          
          // 如果是FF01特征值且可写，则自动选择并订阅
          if (isFF01 && (characteristic.properties.write || characteristic.properties.writeNoResponse)) {
            console.log('自动选择FF01特征值', characteristic.uuid)
            
            // 选择特征值
            this.setData({
              selectedCharacteristic: characteristic.uuid,
              selectedServiceId: serviceId,
              isToyConnected: true
            })
            
            // 如果支持通知，也进行订阅
            if (characteristic.properties.notify || characteristic.properties.indicate) {
              this.notifyBLECharacteristicValueChange(deviceId, serviceId, characteristic.uuid, true)
            }
            
            ff01CharacteristicFound = true
            wx.hideLoading()
            wx.showToast({
              title: '连接成功并选择FF01特征值',
              icon: 'success'
            })
          } 
          // 对于非FF01特征值，如果支持通知则订阅
          else if ((characteristic.properties.notify || characteristic.properties.indicate) && characteristic.uuid) {
            this.notifyBLECharacteristicValueChange(deviceId, serviceId, characteristic.uuid, true)
          }
        })
        
        // 如果是玩具设备连接但未找到FF01特征值，显示错误提示
        if (!ff01CharacteristicFound && deviceId === this.data.connectedDeviceId) {
          // 不直接失败，给用户一个机会手动选择特征值
          wx.hideLoading()
          console.warn('未找到FF01特征值，可能需要手动选择')
        }
      },
      fail: (err) => {
        console.error('获取特征值失败', err)
        // 确保总是隐藏loading
        wx.hideLoading()
      }
    })
  },

  // 订阅特征值
  notifyBLECharacteristicValueChange(deviceId, serviceId, characteristicId, state) {
    // 确保所有参数都有效
    if (!deviceId || !serviceId || !characteristicId) {
      console.error('订阅特征值失败：参数无效', deviceId, serviceId, characteristicId)
      return
    }
    
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state,
      success: (res) => {
        console.log('订阅特征值成功', res)
      },
      fail: (err) => {
        console.error('订阅特征值失败', err)
      }
    })
  },

  // 选择特征值
  selectCharacteristic(e) {
    const { uuid, serviceId } = e.currentTarget.dataset
    // 添加空值检查
    if (!uuid || !serviceId) {
      wx.showToast({ 
        title: '特征值信息不完整', 
        icon: 'error' 
      })
      return
    }
    this.setData({
      selectedCharacteristic: uuid,
      selectedServiceId: serviceId,
      // 如果选择的是FF01特征值，标记为玩具已连接
      isToyConnected: typeof uuid === 'string' && uuid.indexOf(this.data.targetCharacteristicUUID) > -1
    })
    wx.showToast({ title: '已选择特征值' })
  },
  
  // 发送启动命令
  sendForwardCommand() {
    this.sendCommand(this.COMMANDS.FORWARD, '启动')
  },
  
  // 发送命令通用方法
  sendCommand(command, commandName) {
    const { connectedDeviceId, selectedServiceId, selectedCharacteristic } = this.data
    
    // 添加更完善的空值检查
    if (!connectedDeviceId) {
      wx.showToast({
        title: '请先连接设备',
        icon: 'error'
      })
      return
    }
    
    if (!selectedCharacteristic || !selectedServiceId) {
      wx.showToast({
        title: '请选择特征值',
        icon: 'error'
      })
      return
    }
    
    // 检查命令格式
    if (!command || typeof command !== 'string') {
      console.error('命令格式无效:', command)
      wx.showToast({
        title: '命令格式无效',
        icon: 'error'
      })
      return
    }
    try {
      // 确保是十六进制格式发送
      const buffer = this.hexStringToArrayBuffer(command)
      
      // 再次验证所有必要参数
      if (!buffer || !connectedDeviceId || !selectedServiceId || !selectedCharacteristic) {
        console.error('发送命令失败：参数无效', { connectedDeviceId, selectedServiceId, selectedCharacteristic, buffer })
        return
      }
      
      wx.writeBLECharacteristicValue({
        deviceId: connectedDeviceId,
        serviceId: selectedServiceId,
        characteristicId: selectedCharacteristic,
        value: buffer,
        success: (res) => {
          console.log(`发送${commandName}命令成功`, res)
          
          // 短暂显示操作提示
          wx.showToast({
            title: `发送${commandName}`,
            duration: 300
          })
        },
        fail: (err) => {
          console.error(`发送${commandName}命令失败`, err)
          wx.showToast({
            title: '发送失败',
            icon: 'error'
          })
        }
      })
    } catch (e) {
      console.error(`发送${commandName}命令时发生错误`, e)
      wx.showToast({
        title: '发送过程出错',
        icon: 'error'
      })
    }
  },

  // 切换高级功能显示
  toggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced
    })
  },
  
  // 断开蓝牙连接
  disconnectDevice() {
    const { connectedDeviceId } = this.data
    
    if (!connectedDeviceId) {
      wx.showToast({
        title: '未连接设备',
        icon: 'error'
      })
      return
    }
    
    wx.showLoading({ title: '正在断开连接...' })
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    // 断开BLE连接
    wx.closeBLEConnection({
      deviceId: connectedDeviceId,
      success: (res) => {
        console.log('断开连接成功', res)
        this.digitalFilter.reset()
        
        this.setData({
          connectedDeviceId: '',
          connectionStatus: '未连接',
          characteristics: [],
          selectedCharacteristic: '',
          selectedServiceId: '',
          services: [],
          isToyConnected: false
        })
        wx.hideLoading()
        wx.showToast({
          title: '断开连接成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('断开连接失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '断开失败',
          icon: 'error'
        })
      }
    })
  },

  // 连接BCI设备
  connectBCIDevice() {
    const { bciDeviceName, bciDeviceId, bciCharacteristicId, isBCIConnected } = this.data
    
    if (isBCIConnected) {
      wx.showToast({
        title: 'BCI设备已连接',
        icon: 'success'
      })
      return
    }
    
    // 先停止搜索
    this.stopBluetoothDevicesDiscovery()
    
    wx.showLoading({ title: '正在搜索BCI设备...' })
    
    // 开始搜索设备
    wx.startBluetoothDevicesDiscovery({
      services: [], // 搜索所有服务的设备
      allowDuplicatesKey: false,
      success: (res) => {
        console.log('开始搜索BCI设备', res)
        
        // 设置搜索超时
        setTimeout(() => {
          this.stopBluetoothDevicesDiscovery()
          this.findAndConnectBCIDevice()
        }, 5000)
      },
      fail: (err) => {
        console.error('搜索BCI设备失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '搜索失败',
          icon: 'error'
        })
      }
    })
  },

  // 查找并连接BCI设备
  findAndConnectBCIDevice() {
    const { bciDeviceName, devices } = this.data
    
    // 在已发现的设备中查找BCI设备
    const bciDevice = devices.find(device => 
      device.name === bciDeviceName || device.deviceId === bciDeviceName
    )
    
    if (bciDevice) {
      console.log('找到BCI设备，准备连接', bciDevice)
      this.connectToBCIDevice(bciDevice.deviceId, bciDevice.name)
    } else {
      wx.hideLoading()
      wx.showToast({
        title: '未找到BCI设备',
        icon: 'error'
      })
    }
  },

  // 连接到BCI设备
  connectToBCIDevice(deviceId, deviceName) {
    wx.showLoading({ title: '正在连接BCI设备...' })
    
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        console.log('连接BCI设备成功', res)
        this.setData({
          bciDeviceId: deviceId,
          isBCIConnected: true,
          connectionStatus: `已连接: ${deviceName || 'BCI设备'}`
        })
        
        // 获取设备服务
        this.getBCIDeviceServices(deviceId)
      },
      fail: (err) => {
        console.error('连接BCI设备失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
      }
    })
  },

  // 获取BCI设备服务
  getBCIDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('获取BCI服务成功', res.services)
        const services = res.services || []
        
        // 查找包含目标特征值的服务
        let targetService = null
        
        services.forEach(service => {
          if (service && service.uuid) {
            this.getBCIDeviceCharacteristics(deviceId, service.uuid)
          }
        })
      },
      fail: (err) => {
        console.error('获取BCI服务失败', err)
        wx.hideLoading()
      }
    })
  },

  // 获取BCI设备特征值
  getBCIDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('获取BCI特征值成功', res.characteristics)
        const characteristics = res.characteristics || []
        
        // 查找目标特征值
        const targetCharacteristic = characteristics.find(char => 
          char && char.uuid && char.uuid.toLowerCase() === this.data.bciCharacteristicId.toLowerCase()
        )
        
        if (targetCharacteristic) {
          console.log('找到目标特征值，开始订阅', targetCharacteristic.uuid)
          
          this.setData({
            bciServiceId: serviceId,
            bciCharacteristicId: targetCharacteristic.uuid
          })
          
          // 订阅特征值通知
          this.notifyBCICharacteristicValueChange(deviceId, serviceId, targetCharacteristic.uuid, true)
          
          wx.hideLoading()
          wx.showToast({
            title: 'BCI设备连接成功',
            icon: 'success'
          })
        }
      },
      fail: (err) => {
        console.error('获取BCI特征值失败', err)
        wx.hideLoading()
      }
    })
  },

  // 订阅BCI特征值
  notifyBCICharacteristicValueChange(deviceId, serviceId, characteristicId, state) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state,
      success: (res) => {
        console.log('订阅BCI特征值成功', res)
      },
      fail: (err) => {
        console.error('订阅BCI特征值失败', err)
      }
    })
  },

  // 断开BCI设备连接
  disconnectBCIDevice() {
    const { bciDeviceId } = this.data
    
    if (!bciDeviceId) {
      wx.showToast({
        title: 'BCI设备未连接',
        icon: 'error'
      })
      return
    }
    
    wx.showLoading({ title: '正在断开BCI连接...' })
    
    wx.closeBLEConnection({
      deviceId: bciDeviceId,
      success: (res) => {
        console.log('断开BCI连接成功', res)
        this.digitalFilter.reset()
        
        this.setData({
          bciDeviceId: '',
          bciServiceId: '',
          bciCharacteristicId: 'f0001682-0451-4000-b000-000000000000',
          isBCIConnected: false
        })
        wx.hideLoading()
        wx.showToast({
          title: 'BCI连接已断开',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('断开BCI连接失败', err)
        wx.hideLoading()
        wx.showToast({
          title: '断开失败',
          icon: 'error'
        })
      }
    })
  },

  // 发送数据
  sendDataToDevice() {
    const { connectedDeviceId, selectedServiceId, selectedCharacteristic, sendData, sendType } = this.data
    
    // 确保所有必要参数都有效
    if (!connectedDeviceId) {
      wx.showToast({
        title: '请先连接设备',
        icon: 'error'
      })
      return
    }
    
    if (!selectedCharacteristic || !selectedServiceId) {
      wx.showToast({
        title: '请选择特征值',
        icon: 'error'
      })
      return
    }
    
    if (!sendData) {
      wx.showToast({
        title: '请输入发送数据',
        icon: 'error'
      })
      return
    }
    
    try {
      let buffer
      if (sendType === 'text') {
        // 文本转ArrayBuffer
        buffer = this.stringToArrayBuffer(sendData)
      } else {
        // 十六进制转ArrayBuffer
        buffer = this.hexStringToArrayBuffer(sendData)
      }
      
      // 确保buffer是有效的ArrayBuffer
      if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
        console.error('转换数据失败：无效的buffer', buffer)
        wx.showToast({
          title: '数据格式错误',
          icon: 'error'
        })
        return
      }
      
      // 再次确保关键参数有效
      if (!connectedDeviceId || !selectedServiceId || !selectedCharacteristic) {
        console.error('发送数据失败：参数无效', { connectedDeviceId, selectedServiceId, selectedCharacteristic })
        wx.showToast({
          title: '参数无效',
          icon: 'error'
        })
        return
      }
      
      wx.writeBLECharacteristicValue({
        deviceId: connectedDeviceId,
        serviceId: selectedServiceId,
        characteristicId: selectedCharacteristic,
        value: buffer,
        success: (res) => {
          console.log('发送数据成功', res)
          
          wx.showToast({ title: '发送成功' })
        },
        fail: (err) => {
          console.error('发送数据失败', err)
          // 提供更详细的错误信息
          const errorMsg = err.errCode ? `发送失败(${err.errCode})` : '发送失败'
          wx.showToast({
            title: errorMsg,
            icon: 'error'
          })
        }
      })
    } catch (e) {
      console.error('发送数据时发生错误', e)
      wx.showToast({
        title: '发送过程出错',
        icon: 'error'
      })
    }
  },

  // 输入发送数据
  onSendDataInput(e) {
    this.setData({
      sendData: e.detail.value
    })
  },

  // 切换发送类型
  onSendTypeChange(e) {
    this.setData({
      sendType: e.detail.value
    })
  },

  // 清空接收数据
  clearReceiveData() {
    this.setData({
      eegData: '',
      latestEEGValue: 0,
      formattedLatestEEGValue: '0.0000'
    })
    wx.showToast({
      title: '脑电数据已清空',
      icon: 'success'
    })
  },

  // 页面卸载时清理数据
  onUnload() {
    // 清理资源
  },

  // 页面隐藏时暂停统计
  onHide() {
    // 页面隐藏时的处理
  },

  // 页面显示时重新开始统计
  onShow() {
    // 页面显示时的处理
  },

  // 工具方法：字符串转ArrayBuffer
  stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length)
    const bufView = new Uint8Array(buf)
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i)
    }
    return buf
  },

  // 工具方法：ArrayBuffer转字符串
  arrayBufferToString(buffer) {
    const uint8Array = new Uint8Array(buffer)
    let str = ''
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i])
    }
    return str
  },

  // 工具方法：十六进制字符串转ArrayBuffer
  hexStringToArrayBuffer(hexString) {
    // 添加空值检查
    if (!hexString || typeof hexString !== 'string') {
      console.error('无效的十六进制字符串:', hexString)
      return new ArrayBuffer(0)
    }
    
    // 移除空格
    hexString = hexString.replace(/\s/g, '')
    
    // 检查是否是有效的十六进制字符
    if (!/^[0-9a-fA-F]+$/.test(hexString)) {
      console.error('十六进制字符串包含无效字符:', hexString)
      return new ArrayBuffer(0)
    }
    
    // 确保字符串长度为偶数
    if (hexString.length % 2 !== 0) {
      hexString = '0' + hexString
    }
    
    const byteLength = hexString.length / 2
    const buffer = new ArrayBuffer(byteLength)
    const bufView = new Uint8Array(buffer)
    
    for (let i = 0; i < byteLength; i++) {
      // 安全的parseInt调用
      const hexPair = hexString.substr(i * 2, 2)
      bufView[i] = parseInt(hexPair, 16)
    }
    
    return buffer
  }
})