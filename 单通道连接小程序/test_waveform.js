// 波形显示功能测试脚本

// 模拟脑电数据解析函数
function parseEEGData(uint8Array) {
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
}

// 模拟添加波形数据点函数
function addWaveformPoint(eegWaveformData, eegValue, maxWaveformPoints = 100) {
  // 添加新的数据点
  const newData = [...eegWaveformData, eegValue]
  
  // 如果数据点超过最大数量，移除最早的数据点
  if (newData.length > maxWaveformPoints) {
    newData.shift()
  }
  
  return newData
}

// 模拟波形绘制函数（简化版）
function drawWaveform(eegWaveformData, waveformMinValue = -1000, waveformMaxValue = 1000) {
  console.log('开始绘制波形...')
  
  // 检查数据
  if (eegWaveformData.length === 0) {
    console.log('波形数据为空，显示空白画布')
    return
  }
  
  if (eegWaveformData.length === 1) {
    console.log(`单个数据点: ${eegWaveformData[0].toFixed(4)}`)
    return
  }
  
  // 绘制波形
  const canvasWidth = 400
  const canvasHeight = 200
  const maxWaveformPoints = 100
  
  console.log(`绘制 ${eegWaveformData.length} 个数据点的波形`)
  
  for (let i = 0; i < eegWaveformData.length; i++) {
    const x = (i / (maxWaveformPoints - 1)) * canvasWidth
    const normalizedValue = (eegWaveformData[i] - waveformMinValue) / (waveformMaxValue - waveformMinValue)
    const y = canvasHeight - (normalizedValue * canvasHeight)
    
    if (i % 10 === 0) { // 每10个点显示一次
      console.log(`点${i}: x=${x.toFixed(1)}, y=${y.toFixed(1)}, 值=${eegWaveformData[i].toFixed(4)}`)
    }
  }
  
  // 绘制当前数据点
  const lastIndex = eegWaveformData.length - 1
  const lastX = (lastIndex / (maxWaveformPoints - 1)) * canvasWidth
  const lastNormalizedValue = (eegWaveformData[lastIndex] - waveformMinValue) / (waveformMaxValue - waveformMinValue)
  const lastY = canvasHeight - (lastNormalizedValue * canvasHeight)
  
  console.log(`当前数据点: x=${lastX.toFixed(1)}, y=${lastY.toFixed(1)}, 值=${eegWaveformData[lastIndex].toFixed(4)}`)
}

// 测试用例
function runWaveformTests() {
  console.log('=== 波形显示功能测试开始 ===\n')
  
  // 测试用例1: 基本波形数据显示
  console.log('测试用例1: 基本波形数据显示')
  let waveformData = []
  
  // 模拟接收到5个脑电数据点
  const testData1 = new Uint8Array([0x01, 0x02, 0x00, 0x80, 0x3F, 0x04, 0x05])
  const testData2 = new Uint8Array([0x01, 0x02, 0x00, 0x90, 0x4F, 0x04, 0x05])
  const testData3 = new Uint8Array([0x01, 0x02, 0x00, 0xA0, 0x5F, 0x04, 0x05])
  const testData4 = new Uint8Array([0x01, 0x02, 0x00, 0xB0, 0x6F, 0x04, 0x05])
  const testData5 = new Uint8Array([0x01, 0x02, 0x00, 0xC0, 0x7F, 0x04, 0x05])
  
  // 先声明所有测试数据变量，再进行数组操作
  const testDataArray = [testData1, testData2, testData3, testData4, testData5]
  
  testDataArray.forEach((data, index) => {
    const eegValue = parseEEGData(data)
    if (eegValue !== null) {
      waveformData = addWaveformPoint(waveformData, eegValue)
      console.log(`数据点${index + 1}: ${eegValue.toFixed(4)}`)
    }
  })
  
  console.log(`当前波形数据点数量: ${waveformData.length}`)
  drawWaveform(waveformData)
  console.log('')
  
  // 测试用例2: 大量数据点测试
  console.log('测试用例2: 大量数据点测试（超过最大点数）')
  let largeWaveformData = []
  
  // 模拟接收到105个脑电数据点（超过100点限制）
  for (let i = 0; i < 105; i++) {
    // 模拟正弦波数据
    const simulatedValue = Math.sin(i * 0.1) * 100 + Math.random() * 20
    largeWaveformData = addWaveformPoint(largeWaveformData, simulatedValue)
  }
  
  console.log(`大量数据测试后，保留数据点数量: ${largeWaveformData.length}`)
  drawWaveform(largeWaveformData)
  console.log('')
  
  // 测试用例3: 空数据和单点数据
  console.log('测试用例3: 空数据和单点数据')
  console.log('空数据测试:')
  drawWaveform([])
  
  console.log('单点数据测试:')
  drawWaveform([123.45])
  console.log('')
  
  // 测试用例4: 波形控制功能
  console.log('测试用例4: 波形控制功能')
  let testData = []
  
  console.log('启动波形显示...')
  console.log('添加10个数据点...')
  for (let i = 0; i < 10; i++) {
    const value = i * 10 + Math.random() * 5
    testData = addWaveformPoint(testData, value)
  }
  
  console.log(`当前数据点数量: ${testData.length}`)
  console.log('清空波形数据...')
  testData = []
  console.log(`清空后数据点数量: ${testData.length}`)
  console.log('')
  
  console.log('=== 波形显示功能测试完成 ===')
}

// 运行测试
runWaveformTests()