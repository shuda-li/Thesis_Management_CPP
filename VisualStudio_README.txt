毕业论文管理系统 Visual Studio 启动补充包 第三版

适用环境
自动查找已安装且具备 C++ 编译组件的 Visual Studio，支持使用 VS2022 的 MSVC v143。
本版不再将检测范围限定为 VS2019；脚本提示保持纯英文 ASCII，避免中文批处理编码问题。
这是原系统的启动补充包，需要配合完整项目源码使用。

操作步骤
1. 将本包内容解压到 D:\szz16\Thesis_Management_CPP，与 README.md、src、web 同级。
2. 双击 Start_Thesis.bat，窗口应显示 Visual Studio Launcher v3。
3. 等待 Build succeeded，并保持服务窗口打开。
4. 浏览器访问 http://127.0.0.1:8080。
5. 学生 student01、教师 teacher01、管理员 admin；初始密码统一为 Demo@2026。

如果仍找不到 C++ 编译环境
打开 Visual Studio Installer，选择你的 Visual Studio 2022，点击“修改”。
在“工作负载”中检查“使用 C++ 的桌面开发”，保留 MSVC v143 与 Windows SDK。
安装完成后重新运行脚本；若该工作负载已安装，则从开始菜单打开：
x64 Native Tools Command Prompt for VS 2022
依次执行：
cd /d "D:\szz16\Thesis_Management_CPP"
cl
Start_Thesis.bat
单独运行 cl 后显示编译器版本并提示缺少源文件，说明工具已可调用。

诊断与兼容
诊断文件为 build-msvc\toolchain-diagnostic.txt，首次编译产生的程序为 build-msvc\thesis_manager.exe。
包内 VS2019_Start.bat 是旧入口的兼容转发文件，会调用同目录的 Start_Thesis.bat。
实际业务数据继续保存在原 data 目录。

验证范围
已检查版本限制移除、组件查询命令、ASCII 编码、CRLF 换行、跳转目标与编译参数。
本机为 Linux，尚未实际执行 Windows MSVC 编译，请以你的电脑上的编译结果为准。

微软编译工具检测说明
https://github.com/microsoft/vswhere/wiki/Find-VC
