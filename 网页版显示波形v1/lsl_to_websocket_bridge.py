#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LSL到WebSocket的桥接服务器
用于将LSL数据流转发到WebSocket，供网页端直接访问
"""

import asyncio
import websockets
import json
import time
from threading import Thread
import sys

# 检查是否已经有mock pylsl实现
mock_pylsl_available = False

# 尝试导入pylsl，如果失败则使用mock实现
try:
    import pylsl
    print("成功导入真实的pylsl库")
except ImportError:
    # 创建mock pylsl实现
    print("未找到pylsl库，使用mock实现")
    mock_pylsl_available = True
    
    class MockStreamInfo:
        def __init__(self, name="MockStream", type="EEG", channel_count=8, nominal_srate=250, channel_format="float32", source_id="mock_source"):
            self.name = name
            self.type = type
            self.channel_count = channel_count
            self.nominal_srate = nominal_srate
            self.channel_format = channel_format
            self.source_id = source_id
        
        def name(self):
            return self.name
        
        def type(self):
            return self.type
        
        def channel_count(self):
            return self.channel_count
        
        def nominal_srate(self):
            return self.nominal_srate
        
        def channel_format(self):
            return self.channel_format
        
        def source_id(self):
            return self.source_id
    
    class MockStreamInlet:
        def __init__(self, stream_info):
            self.stream_info = stream_info
            self.samples_read = 0
            import random
            self.random = random
        
        def pull_sample(self, timeout=1.0):
            time.sleep(0.01)  # 模拟采样间隔
            self.samples_read += 1
            # 生成模拟数据
            sample = [self.random.random() * 100 - 50 for _ in range(self.stream_info.channel_count)]
            timestamp = time.time()
            return sample, timestamp
    
    # 模拟pylsl模块
    class MockPyLSL:
        def __init__(self):
            self.StreamInfo = MockStreamInfo
            self.StreamInlet = MockStreamInlet
        
        def resolve_stream(self, name=None, type=None, minimum=1, timeout=1.0):
            print(f"Mock: 解析流 - name={name}, type={type}")
            # 返回一个模拟的流信息列表
            return [MockStreamInfo(name="MockEEGStream", type="EEG", channel_count=8, nominal_srate=250)]
        
        def resolve_byprop(self, prop, value, minimum=1, timeout=1.0):
            print(f"Mock: 通过属性解析流 - prop={prop}, value={value}")
            return [MockStreamInfo(name="MockEEGStream", type="EEG", channel_count=8, nominal_srate=250)]
    
    pylsl = MockPyLSL()

# WebSocket服务器设置
HOST = 'localhost'
PORT = 8766

# 全局变量
clients = set()
stream_inlet = None
stream_info = None
running = True

# 发送数据给所有连接的客户端
async def broadcast_data(data):
    if clients:
        message = json.dumps(data)
        await asyncio.gather(
            *[client.send(message) for client in clients],
            return_exceptions=True
        )

# 处理客户端连接
async def handle_client(websocket):
    # 注册新客户端
    clients.add(websocket)
    print(f"新客户端连接: {websocket.remote_address}")
    
    # 发送流信息给新连接的客户端
    if stream_info:
        info_data = {
            "type": "stream_info",
            "data": {
                "name": stream_info.name() if hasattr(stream_info.name, '__call__') else stream_info.name,
                "type": stream_info.type() if hasattr(stream_info.type, '__call__') else stream_info.type,
                "channel_count": stream_info.channel_count() if hasattr(stream_info.channel_count, '__call__') else stream_info.channel_count,
                "sampling_rate": stream_info.nominal_srate() if hasattr(stream_info.nominal_srate, '__call__') else stream_info.nominal_srate,
                "source_id": stream_info.source_id() if hasattr(stream_info.source_id, '__call__') else stream_info.source_id
            }
        }
        await websocket.send(json.dumps(info_data))
    
    try:
        # 接收客户端消息（虽然我们可能不需要处理它们）
        async for message in websocket:
            print(f"收到消息: {message}")
            # 可以在这里添加处理客户端命令的代码
    except websockets.exceptions.ConnectionClosed:
        print(f"客户端断开连接: {websocket.remote_address}")
    finally:
        # 注销客户端
        clients.remove(websocket)

# 从LSL流中读取数据并广播
async def read_and_broadcast_lsl_data():
    global stream_inlet, stream_info
    
    # 等待LSL流连接
    while running:
        try:
            # 尝试连接到任何可用的LSL流
            print("正在查找LSL流...")
            streams = pylsl.resolve_stream()
            
            if streams:
                print(f"找到 {len(streams)} 个LSL流")
                # 使用第一个找到的流
                stream_info = streams[0]
                stream_inlet = pylsl.StreamInlet(stream_info)
                
                # 获取流信息
                name = stream_info.name() if hasattr(stream_info.name, '__call__') else stream_info.name
                stream_type = stream_info.type() if hasattr(stream_info.type, '__call__') else stream_info.type
                channel_count = stream_info.channel_count() if hasattr(stream_info.channel_count, '__call__') else stream_info.channel_count
                sampling_rate = stream_info.nominal_srate() if hasattr(stream_info.nominal_srate, '__call__') else stream_info.nominal_srate
                
                print(f"连接到流: {name} ({stream_type})")
                print(f"通道数: {channel_count}, 采样率: {sampling_rate} Hz")
                
                # 读取并广播数据
                while running and stream_inlet:
                    try:
                        # 尝试获取一个样本
                        sample, timestamp = stream_inlet.pull_sample(timeout=0.01)
                        
                        if sample is not None:
                            # 准备数据消息
                            data_message = {
                                "type": "data",
                                "timestamp": timestamp,
                                "data": sample
                            }
                            
                            # 广播数据给所有连接的客户端
                            await broadcast_data(data_message)
                        
                        # 短暂暂停以避免CPU占用过高
                        await asyncio.sleep(0.001)
                    
                    except Exception as e:
                        print(f"读取LSL数据时出错: {e}")
                        await asyncio.sleep(0.1)
            else:
                # 如果没有找到流，等待一段时间后重试
                print("未找到LSL流，将在5秒后重试...")
                await asyncio.sleep(5)
        
        except Exception as e:
            print(f"查找LSL流时出错: {e}")
            await asyncio.sleep(5)

# 启动服务器
async def start_server():
    # 创建并启动WebSocket服务器
    server = await websockets.serve(handle_client, HOST, PORT)
    print(f"WebSocket服务器启动在 ws://{HOST}:{PORT}")
    
    # 启动LSL数据读取任务
    data_task = asyncio.create_task(read_and_broadcast_lsl_data())
    
    # 运行直到收到终止信号
    try:
        await server.serve_forever()
    except asyncio.CancelledError:
        pass
    finally:
        # 清理任务
        data_task.cancel()
        await data_task
        server.close()
        await server.wait_closed()

def main():
    global running
    
    print("LSL到WebSocket桥接服务器启动中...")
    print(f"将在 ws://{HOST}:{PORT} 提供服务")
    print("按 Ctrl+C 停止服务器")
    
    try:
        # 运行异步服务器
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\n正在停止服务器...")
        running = False
        print("服务器已停止")
    except Exception as e:
        print(f"服务器错误: {e}")
        running = False

if __name__ == "__main__":
    main()