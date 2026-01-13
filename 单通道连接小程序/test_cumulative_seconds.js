// 测试累计秒数功能的脚本
// 模拟蓝牙小程序的数据统计逻辑

// 模拟Page对象
const mockPage = {
  data: {
    // 字节数统计
    totalBytesReceived: 0,
    currentSecondBytes: 0,
    lastSecondBytes: 0,
    bytesPerSecond: 0,
    bciBytesPerSecond: 0,
    toyBytesPerSecond: 0,
    statsTimer: null,
    statsStartTime: 0,
    totalElapsedSeconds: 0
  },

  // 启动字节数统计
  startByteStats() {
    this.setData({
      statsStartTime: Date.now(),
      totalBytesReceived: 0,
      currentSecondBytes: 0,
      lastSecondBytes: 0,
      bytesPerSecond: 0,
      bciBytesPerSecond: 0,
      toyBytesPerSecond: 0,
      totalElapsedSeconds: 0
    })
    console.log('统计启动，时间戳:', this.data.statsStartTime)
  },

  // 更新字节数统计
  updateByteStats() {
    const { currentSecondBytes, bciBytesPerSecond, toyBytesPerSecond, statsStartTime } = this.data
    
    // 计算累计秒数
    const elapsedSeconds = Math.floor((Date.now() - statsStartTime) / 1000)
    
    this.setData({
      lastSecondBytes: currentSecondBytes,
      bytesPerSecond: currentSecondBytes,
      bciBytesPerSecond: bciBytesPerSecond,
      toyBytesPerSecond: toyBytesPerSecond,
      currentSecondBytes: 0,
      bciBytesPerSecond: 0,
      toyBytesPerSecond: 0,
      totalElapsedSeconds: elapsedSeconds
    })

    console.log(`累计秒数: ${elapsedSeconds}秒, 字节统计: ${currentSecondBytes}B/s`)
  },

  // 模拟数据接收
  updateByteCount(dataLength, isBCIData) {
    const { 
      totalBytesReceived, 
      currentSecondBytes, 
      bciBytesPerSecond, 
      toyBytesPerSecond 
    } = this.data
    
    this.setData({
      totalBytesReceived: totalBytesReceived + dataLength,
      currentSecondBytes: currentSecondBytes + dataLength
    })
    
    if (isBCIData) {
      this.setData({
        bciBytesPerSecond: bciBytesPerSecond + dataLength
      })
    } else {
      this.setData({
        toyBytesPerSecond: toyBytesPerSecond + dataLength
      })
    }
  },

  // 模拟setData方法
  setData(data) {
    Object.assign(this.data, data)
  }
}

// 测试函数
function runTest() {
  console.log('=== 累计秒数功能测试开始 ===')
  
  // 启动统计
  mockPage.startByteStats()
  
  // 模拟接收一些数据
  mockPage.updateByteCount(50, true) // BCI设备数据
  mockPage.updateByteCount(30, false) // 玩具设备数据
  
  // 等待1秒后更新统计
  setTimeout(() => {
    mockPage.updateByteStats()
    
    // 再接收一些数据
    mockPage.updateByteCount(70, true) // BCI设备数据
    mockPage.updateByteCount(20, false) // 玩具设备数据
    
    // 等待1秒后再次更新统计
    setTimeout(() => {
      mockPage.updateByteStats()
      
      // 再等待1秒后显示最终结果
      setTimeout(() => {
        mockPage.updateByteStats()
        
        console.log('=== 测试结果 ===')
        console.log(`总接收字节数: ${mockPage.data.totalBytesReceived} 字节`)
        console.log(`累计秒数: ${mockPage.data.totalElapsedSeconds} 秒`)
        console.log(`每秒平均字节数: ${(mockPage.data.totalBytesReceived / mockPage.data.totalElapsedSeconds).toFixed(2)} B/s`)
        console.log('=== 测试完成 ===')
      }, 1000)
    }, 1000)
  }, 1000)
}

// 运行测试
runTest()