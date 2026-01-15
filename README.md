# Single-Channel-Headset-Program
本工具集包含 LSL 数据流查看器与单道连接小程序，是 Python LSL 数据流场景下的辅助工具：
LSL 数据流查看器
通过lsl_to_websocket_bridge.py桥接服务，实现 Python LSL 数据流的可视化管理 —— 支持连接 LSL 流、自动检测可用流，可查看实时波形数据、流信息（名称 / 类型 / 通道数等）、数据统计（接收样本数 / 速率等），还能配置滤波参数优化信号查看效果。
单道连接小程序
专注单通道 LSL 流的轻量工具，简化单通道场景下的 LSL 流连接流程，适合单通道数据的快速调试、轻量查看场景。
基础使用（以 LSL 数据流查看器为例）
运行python3 lsl_to_websocket_bridge.py启动桥接服务器；
确保 Python LSL 数据流发送程序处于运行状态；
点击界面中 “连接到 LSL 流” 按钮，系统自动检测并连接可用 LSL 流；
在图表、流信息等区域查看实时数据与统计内容。
