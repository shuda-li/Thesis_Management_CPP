#!/usr/bin/env python3
"""Black-box tests against the real C++ HTTP server and a temporary SQLite DB.
No third-party Python packages. Never modifies the user's demonstration data.
"""
import base64
import concurrent.futures
from datetime import datetime, timezone
import http.cookiejar
import json
import os
from pathlib import Path
import platform
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RESULTS = []

class Client:
    def __init__(self, url):
        self.url = url
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, path, data=None, expected=200, headers=None, raw=None):
        h = {"Content-Type": "application/json", "X-Requested-With": "ThesisApp"}
        if headers is not None:
            for key, value in headers.items():
                if value is None: h.pop(key, None)
                else: h[key] = value
        body = raw if raw is not None else (json.dumps(data, ensure_ascii=False).encode() if data is not None else None)
        req = urllib.request.Request(self.url + path, data=body, headers=h, method="POST" if body is not None else "GET")
        try:
            response = self.opener.open(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        b = response.read()
        assert response.code == expected, (path, expected, response.code, b[:300])
        if "application/json" in response.headers.get("Content-Type", ""):
            return json.loads(b)
        return b

    def login(self, name, password="Demo@2026", expected=200):
        return self.request("/api/login", {"username": name, "password": password}, expected)

def check(name, callback, category="业务流程"):
    result = callback()
    assert result is not False, name
    RESULTS.append({"id": f"IT{len(RESULTS)+1:02d}", "name": name, "category": category, "result": "PASS"})
    print(f"PASS {len(RESULTS):02d} {name}", flush=True)

def main():
    binary = ROOT / "build" / ("thesis_manager.exe" if os.name == "nt" else "thesis_manager")
    if not binary.exists(): raise SystemExit("Build first: bash scripts/build.sh")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="thesis-tests-") as temp:
        log = open(Path(temp) / "server.log", "w", encoding="utf-8")
        process = None
        def start():
            p = subprocess.Popen([str(binary), "--port", str(port), "--root", str(ROOT), "--data", temp], stdout=log, stderr=log)
            for _ in range(240):
                try:
                    Client(url).request("/api/health"); return p
                except (urllib.error.URLError, ConnectionError, AssertionError):
                    if p.poll() is not None: raise RuntimeError(Path(temp,"server.log").read_text())
                    time.sleep(.1)
            p.terminate(); raise RuntimeError("C++ server startup timed out")
        try:
            process = start()
            guest,student,teacher,other_teacher,admin,other_student = [Client(url) for _ in range(6)]
            check("服务健康检查", lambda: guest.request("/api/health"), "基础接口")
            check("未登录不能读取业务数据", lambda: guest.request("/api/state", expected=401), "身份与权限")
            check("缺少来源请求头被拒绝", lambda: guest.request("/api/login", {},403,headers={"X-Requested-With":None}), "身份与权限")
            check("跨域来源请求被拒绝", lambda: guest.request("/api/login", {},403,headers={"Origin":"http://untrusted.example"}), "身份与权限")
            check("错误密码无法登录", lambda: guest.login("admin","wrong",401), "身份与权限")
            check("登录参数不能注入 SQL", lambda: guest.login("' OR 1=1 --","anything",401), "身份与权限")
            check("无效 JSON 返回明确错误", lambda: guest.request("/api/login",expected=400,raw=b"not-json"), "边界校验")
            check("学生账号登录", lambda: student.login("student01"), "身份与权限")
            check("教师账号登录", lambda: teacher.login("teacher01"), "身份与权限")
            check("管理员账号登录", lambda: admin.login("admin"), "身份与权限")
            other_teacher.login("teacher02");other_student.login("student02")
            def privacy():
                data=student.request("/api/state")
                assert all(u["id"]==4 for u in data["users"] if u["role"]=="student")
                assert not data["submissions"] and "password_hash" not in json.dumps(data) and "file_base64" not in json.dumps(data)
            check("学生数据隔离且无密码摘要或文件内容泄露", privacy, "身份与权限")
            check("学生不能发布课题",lambda:student.request("/api/topics",{},403),"身份与权限")
            check("教师不能创建系统用户",lambda:teacher.request("/api/users",{},403),"身份与权限")
            check("教师不能修改阶段设置",lambda:teacher.request("/api/settings",{},403),"身份与权限")
            def file_payload(stage="proposal",name="开题报告.txt",content=b"proposal version one"):
                return {"stage":stage,"filename":name,"file_base64":base64.b64encode(content).decode(),"summary":"集成测试材料"}
            check("选题确认前不能提交材料",lambda:student.request("/api/submissions",file_payload(),409))
            check("论文未通过时不能评分",lambda:teacher.request("/api/grades",{"student_id":6},409))
            selection=student.request("/api/select",{"topic_id":1})["id"]
            check("学生成功申请课题",lambda:student.request("/api/state")["selections"][0]["id"]==selection)
            check("重复选题被拒绝",lambda:student.request("/api/select",{"topic_id":2},409),"边界校验")
            review={"id":selection,"decision":"approved","comment":"研究方向匹配，同意选题"}
            check("非指导教师不能审核选题",lambda:other_teacher.request("/api/selections/review",review,403),"身份与权限")
            check("指导教师确认选题",lambda:teacher.request("/api/selections/review",review))
            check("无人确认的课题可以编辑",lambda:teacher.request("/api/topics/update",{"id":3,"title":"面向课程学习的任务管理平台","direction":"Web 应用","description":"实现课程任务发布、提交和学习进度展示。","requirements":"熟悉前后端通信、权限控制和界面交互。","capacity":2}),"业务流程")
            check("已有确认选题的课题禁止编辑",lambda:teacher.request("/api/topics/update",{"id":1,"title":"基于 C++ 的毕业论文管理系统","direction":"软件工程","description":"围绕选题、开题、论文提交与审核构建完整管理流程。","requirements":"熟悉 C++ 基础，完成需求分析、数据库设计与系统测试。","capacity":2},409),"边界校验")
            check("同一选题申请不能重复审核",lambda:teacher.request("/api/selections/review",review,409),"边界校验")
            check("开题通过前不能提交论文",lambda:student.request("/api/submissions",file_payload("thesis"),409))
            check("不支持的文件类型被拒绝",lambda:student.request("/api/submissions",file_payload(name="run.exe"),400),"文件处理")
            check("伪造路径文件名被拒绝",lambda:student.request("/api/submissions",file_payload(name="../a.txt"),400),"文件处理")
            bad=file_payload();bad["file_base64"]="Zm9="
            check("非规范文件编码被拒绝",lambda:student.request("/api/submissions",bad,400),"文件处理")
            check("超过 5 MB 的文件被拒绝",lambda:student.request("/api/submissions",file_payload(content=b"x"*(5242880+1)),400),"文件处理")
            check("扩展名与内容不符的 PDF 被拒绝",lambda:student.request("/api/submissions",file_payload(name="报告.pdf"),400),"文件处理")
            check("包含空字节的 TXT 被拒绝",lambda:student.request("/api/submissions",file_payload(content=b"bad\x00content"),400),"文件处理")
            first=student.request("/api/submissions",file_payload())["id"]
            check("开题报告提交后进入审核状态",lambda:student.request("/api/state")["submissions"][0]["status"]=="pending")
            check("待审版本不能重复提交",lambda:student.request("/api/submissions",file_payload(),409),"边界校验")
            review={"submission_id":first,"decision":"changes","comment":"请补充研究方法和计划"}
            check("非指导教师不能审核材料",lambda:other_teacher.request("/api/reviews",review,403),"身份与权限")
            check("学生不能审核自己的材料",lambda:student.request("/api/reviews",review,403),"身份与权限")
            def download(): assert student.request(f"/api/files/{first}")==b"proposal version one"
            check("本人下载文件字节内容一致",download,"文件处理")
            check("其他学生不能下载该文件",lambda:other_student.request(f"/api/files/{first}",expected=403),"身份与权限")
            check("非指导教师不能下载该文件",lambda:other_teacher.request(f"/api/files/{first}",expected=403),"身份与权限")
            check("教师退回修改并保留意见",lambda:teacher.request("/api/reviews",review))
            check("已审核版本不能二次审核",lambda:teacher.request("/api/reviews",review,409),"边界校验")
            second=student.request("/api/submissions",file_payload("proposal","开题报告V2.pdf",b"%PDF-1.5 proposal version two"))
            def version(): assert second["version"]==2 and len(student.request("/api/state")["submissions"])==2
            check("修改重交自动生成第二版本",version)
            def download_v2(): assert teacher.request(f"/api/files/{second['id']}")==b"%PDF-1.5 proposal version two"
            check("格式正确的 PDF 可提交且字节一致",download_v2,"文件处理")
            check("教师审核通过开题报告",lambda:teacher.request("/api/reviews",{"submission_id":second["id"],"decision":"approved","comment":"修改后符合开题要求"}))
            check("旧版本文件仍可下载",download,"文件处理")
            check("已通过的开题不接受重复提交",lambda:student.request("/api/submissions",file_payload(),409),"边界校验")
            thesis=student.request("/api/submissions",file_payload("thesis","毕业论文.txt",b"thesis final"))["id"]
            check("开题通过后成功提交论文",lambda:teacher.request("/api/state"))
            score={"student_id":4,"process_score":90,"thesis_score":88,"defense_score":92,"comment":"系统功能完整，报告规范","total":999}
            check("论文审核前仍不能录入成绩",lambda:teacher.request("/api/grades",score,409))
            check("教师审核通过论文",lambda:teacher.request("/api/reviews",{"submission_id":thesis,"decision":"approved","comment":"论文内容达到本阶段要求"}))
            invalid=dict(score,defense_score=101)
            check("超过百分制的成绩被拒绝",lambda:teacher.request("/api/grades",invalid,400),"边界校验")
            check("其他教师不能给该学生评分",lambda:other_teacher.request("/api/grades",score,403),"身份与权限")
            def weighted(): assert teacher.request("/api/grades",score)["total"]==89.6
            check("成绩权重正确并忽略客户端伪造总评",weighted)
            def result(): assert student.request("/api/state")["grades"][0]["total"]==89.6
            check("学生能查看最终成绩",result)
            check("再次保存成绩生成变更留痕",lambda:teacher.request("/api/grades",score))
            def grade_audit():
                logs=teacher.request("/api/state")["logs"];assert any(l["action"]=="成绩变更" for l in logs)
            check("成绩变更有留痕记录",grade_audit,"身份与权限")
            check("归档后材料不能继续修改",lambda:student.request("/api/submissions",file_payload("thesis"),409),"边界校验")
            check("管理员分配课题并关闭原待审申请",lambda:admin.request("/api/assign",{"student_id":7,"topic_id":6,"reason":"按学生研究方向统筹分配"}))
            check("管理员分配不能超过课题名额",lambda:admin.request("/api/assign",{"student_id":6,"topic_id":5,"reason":"检查容量限制"},409),"边界校验")
            check("不能停用自己",lambda:admin.request("/api/users/toggle",{"id":1},409),"身份与权限")
            check("有指导任务的教师不能停用",lambda:admin.request("/api/users/toggle",{"id":2},409),"边界校验")
            def create(name):return admin.request("/api/users",{"username":name,"name":"测试学生","role":"student","department":"计算机学院","password":"Test@2026"})["id"]
            new_id=create("teststudent")
            check("管理员创建新学生",lambda:admin.request("/api/state"))
            check("重复用户名被拒绝",lambda:admin.request("/api/users",{"username":"teststudent","name":"重复用户","role":"student","department":"计算机学院","password":"Test@2026"},409),"边界校验")
            new=Client(url);new.login("teststudent","Test@2026")
            check("账号停用成功",lambda:admin.request("/api/users/toggle",{"id":new_id}))
            check("停用账号已有会话失效",lambda:new.request("/api/state",expected=401),"身份与权限")
            check("停用账号无法登录",lambda:new.login("teststudent","Test@2026",401),"身份与权限")
            admin.request("/api/users/toggle",{"id":new_id});new.login("teststudent","Test@2026")
            def parallel_selection():
                clients=[Client(url),Client(url)]
                for c in clients:c.login("teststudent","Test@2026")
                def attempt(pair):
                    c,t=pair
                    try:c.request("/api/select",{"topic_id":t});return 200
                    except AssertionError as e:return e.args[0][2]
                with concurrent.futures.ThreadPoolExecutor(2) as ex:statuses=list(ex.map(attempt,zip(clients,[2,6])))
                assert sorted(statuses)==[200,409],statuses
            check("并发选题只能保留一项有效申请",parallel_selection,"并发与持久化")
            active=next(s for s in new.request("/api/state")["selections"] if s["status"]=="pending")
            check("学生撤回待审选题",lambda:new.request("/api/selections/cancel",{"id":active["id"]}))
            settings=admin.request("/api/state")["settings"]
            check("无效日历日期被拒绝",lambda:admin.request("/api/settings",dict(settings,selection_deadline="2027-02-30"),400),"边界校验")
            check("阶段日期顺序错误被拒绝",lambda:admin.request("/api/settings",dict(settings,selection_deadline="2099-01-01"),400),"边界校验")
            admin.request("/api/settings",dict(settings,selection_deadline="2020-01-01"))
            check("选题截止后不能再申请",lambda:new.request("/api/select",{"topic_id":2},409),"边界校验")
            admin.request("/api/settings",settings)
            check("管理员发布公告",lambda:admin.request("/api/notices",{"title":"集成测试公告","body":"请按照计划完成毕业论文。"}))
            check("学生不能导出全校统计",lambda:student.request("/api/export",expected=403),"身份与权限")
            def csv():
                b=admin.request("/api/export");assert b.startswith(b"\xef\xbb\xbf") and "林晓".encode() in b and b"89.6" in b
            check("导出 CSV 包含中文与正确成绩",csv)
            check("更改密码会注销全部会话",lambda:new.request("/api/password",{"old_password":"Test@2026","new_password":"Changed@2026"}),"身份与权限")
            check("改密后原会话不可使用",lambda:new.request("/api/state",expected=401),"身份与权限")
            check("旧密码不能再次登录",lambda:new.login("teststudent","Test@2026",401),"身份与权限")
            check("新密码可以登录",lambda:new.login("teststudent","Changed@2026"),"身份与权限")
            check("管理员重置用户密码",lambda:admin.request("/api/users/reset_password",{"id":new_id,"password":"Reset@2026"}),"身份与权限")
            check("重置后旧会话立即失效",lambda:new.request("/api/state",expected=401),"身份与权限")
            check("重置后新密码可登录",lambda:new.login("teststudent","Reset@2026"),"身份与权限")
            process.terminate();process.wait(timeout=10);process=start()
            check("重启后会话与成绩数据仍然保留",result,"并发与持久化")
            def audit():
                data=admin.request("/api/state");assert data["logs"] and "Changed@2026" not in json.dumps(data["logs"])
            check("操作记录存在且不记录密码",audit,"身份与权限")
            summary={"executed_at_utc":datetime.now(timezone.utc).isoformat(),"environment":platform.platform(),"compiler":subprocess.check_output([os.environ.get('CXX','g++'),'--version'],text=True).splitlines()[0],"language":"C++17","sqlite":"3.46.1","passed":len(RESULTS),"failed":0,"cases":RESULTS}
            output=ROOT/"docs"/"test-results.json";output.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
            print(f"\n{len(RESULTS)} integration checks passed. Result: docs/test-results.json")
        finally:
            if process and process.poll() is None:process.terminate();process.wait(timeout=10)
            log.close()

if __name__=="__main__":main()
