// 测试脑电数据解析功能的脚本

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

    console.log(`原始字节数据: ${byte1.toString(16).padStart(2, '0')} ${byte2.toString(16).padStart(2, '0')} ${byte3.toString(16).padStart(2, '0')}`)

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

// 测试用例
function runEEGTests() {
  console.log('=== 脑电数据解析测试开始 ===\n')

  // 测试用例1: 正常数据
  console.log('测试用例1: 正常脑电数据包')
  const testData1 = new Uint8Array([0x01, 0x02, 0x00, 0x80, 0x3F, 0x04, 0x05])
  const result1 = parseEEGData(testData1)
  console.log(`测试1结果: ${result1 ? result1.toFixed(4) : '解析失败'}\n`)

  // 测试用例2: 大数值
  console.log('测试用例2: 大数值脑电数据')
  const testData2 = new Uint8Array([0x01, 0x02, 0xFF, 0xFF, 0xFF, 0x06, 0x07])
  const result2 = parseEEGData(testData2)
  console.log(`测试2结果: ${result2 ? result2.toFixed(4) : '解析失败'}\n`)

  // 测试用例3: 小数值
  console.log('测试用例3: 小数值脑电数据')
  const testData3 = new Uint8Array([0x01, 0x02, 0x00, 0x01, 0x00, 0x08, 0x09])
  const result3 = parseEEGData(testData3)
  console.log(`测试3结果: ${result3 ? result3.toFixed(4) : '解析失败'}\n`)

  // 测试用例4: 数据包长度不足
  console.log('测试用例4: 数据包长度不足')
  const testData4 = new Uint8Array([0x01, 0x02])
  const result4 = parseEEGData(testData4)
  console.log(`测试4结果: ${result4 ? result4.toFixed(4) : '解析失败'}\n`)

  // 测试用例5: 零值
  console.log('测试用例5: 零值脑电数据')
  const testData5 = new Uint8Array([0x01, 0x02, 0x00, 0x00, 0x00, 0x06, 0x07])
  const result5 = parseEEGData(testData5)
  console.log(`测试5结果: ${result5 ? result5.toFixed(4) : '解析失败'}\n`)

  console.log('=== 脑电数据解析测试完成 ===')
}

// 运行测试
runEEGTests()