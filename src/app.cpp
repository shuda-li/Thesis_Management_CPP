#include "app.hpp"
#include "security.hpp"
#include <algorithm>
#include <cmath>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <regex>
#include <sstream>

namespace {
long long epoch() { return std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count(); }
std::string time_text(long long seconds, const char* pattern) {
    std::time_t value = static_cast<std::time_t>(seconds); std::tm tm{};
#ifdef _WIN32
    gmtime_s(&tm, &value);
#else
    gmtime_r(&value, &tm);
#endif
    std::ostringstream os; os << std::put_time(&tm, pattern); return os.str();
}
std::string now() { return time_text(epoch(), "%Y-%m-%d %H:%M:%S"); }
std::string today() { return time_text(epoch(), "%Y-%m-%d"); }
HttpReply ok(const Json& data) { HttpReply r; r.body = data.dump(); return r; }
void require(bool condition, int code, const std::string& message) { if (!condition) throw ApiError(code, message); }
std::string text(const Json& input, const std::string& key, size_t min, size_t max) {
    require(input.contains(key) && input[key].is_string(), 400, "缺少或无效的字段：" + key);
    auto s = input[key].get<std::string>();
    auto start = s.find_first_not_of(" \t\r\n"); auto end = s.find_last_not_of(" \t\r\n");
    s = start == std::string::npos ? "" : s.substr(start, end - start + 1);
    require(s.size() >= min && s.size() <= max && s.find('\0') == std::string::npos, 400, "字段长度不符合要求：" + key); return s;
}
long long integer(const Json& input, const std::string& key, long long min = 1, long long max = 2147483647) {
    require(input.contains(key) && input[key].is_number_integer(), 400, "无效的整数：" + key);
    auto n = input[key].get<long long>(); require(n >= min && n <= max, 400, "数值超出范围：" + key); return n;
}
double score(const Json& input, const std::string& key) {
    require(input.contains(key) && input[key].is_number(), 400, "请填写成绩：" + key);
    auto n = input[key].get<double>(); require(std::isfinite(n) && n >= 0 && n <= 100, 400, "成绩必须在 0 到 100 之间"); return n;
}
bool valid_date(const std::string& date) {
    if (!std::regex_match(date, std::regex("[0-9]{4}-[0-9]{2}-[0-9]{2}"))) return false;
    int y = std::stoi(date.substr(0, 4)), m = std::stoi(date.substr(5, 2)), d = std::stoi(date.substr(8, 2));
    int days[] = {0,31,28,31,30,31,30,31,31,30,31,30,31};
    if (y < 2020 || y > 2100 || m < 1 || m > 12) return false;
    if ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) days[2] = 29;
    return d >= 1 && d <= days[m];
}
std::string session_token(const std::string& cookie) {
    std::istringstream stream(cookie); std::string item;
    while (std::getline(stream, item, ';')) {
        auto first = item.find_first_not_of(' '); if (first == std::string::npos) continue; item = item.substr(first);
        if (item.rfind("THESIS_SESSION=", 0) == 0) {
            auto value = item.substr(15);
            if (std::regex_match(value, std::regex("[a-f0-9]{64}"))) return value;
        }
    }
    return "";
}
std::string encoded_filename(const std::string& s) {
    std::ostringstream out; out << std::hex << std::uppercase;
    for (unsigned char c : s) { if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-') out << c; else out << '%' << std::setw(2) << std::setfill('0') << int(c); }
    return out.str();
}
std::string csv_cell(std::string s) {
    if (!s.empty() && (s[0] == '=' || s[0] == '+' || s[0] == '-' || s[0] == '@' || s[0] == '\t' || s[0] == '\r')) s = "'" + s;
    std::string out = "\""; for (char c : s) { if (c == '"') out += '"'; out += c; } return out + "\"";
}
} // namespace

Application::Application(const std::string& path, const std::string& schema_path) : db_(path) {
    auto version = db_.scalar("PRAGMA user_version");
    if (version == 0) {
        std::ifstream schema(schema_path, std::ios::binary); require(bool(schema), 500, "找不到数据库结构文件");
        std::string content((std::istreambuf_iterator<char>(schema)), {}); Transaction tx(db_); db_.exec(content); tx.commit();
    } else if (version != 1) throw std::runtime_error("Unsupported database schema version");
    seed();
}

void Application::seed() {
    if (db_.scalar("SELECT COUNT(*) FROM users") > 0) return;
    Transaction tx(db_); auto stamp = now();
    Json users = {{"admin","教务管理员","admin"},{"teacher01","陈明","teacher"},{"teacher02","李悦","teacher"},
                  {"student01","林晓","student"},{"student02","周宁","student"},{"student03","王涵","student"},
                  {"student04","赵晨","student"},{"student05","许知远","student"},{"student06","苏沐","student"}};
    for (const auto& u : users) db_.run("INSERT INTO users(username,name,role,department,password_hash,created_at) VALUES(?,?,?,?,?,?)", {u[0],u[1],u[2],"计算机学院",security::password_hash("Demo@2026"),stamp});
    Json topics = {
      {"基于 C++ 的毕业论文管理系统","软件工程","围绕选题、开题、论文提交与审核构建完整管理流程。","熟悉 C++ 基础，完成需求分析、数据库设计与系统测试。",2,2},
      {"校园图书借阅管理系统设计与实现","信息管理","设计图书检索、借阅归还与统计模块。","掌握面向对象设计和关系型数据库基础。",2,2},
      {"面向课程学习的任务管理平台","Web 应用","实现课程任务发布、提交和学习进度展示。","熟悉前后端通信、权限控制和界面交互。",2,1},
      {"基于数据分析的校园能耗可视化","数据分析","对模拟校园能耗数据进行分析并展示趋势。","掌握基础数据处理，注明数据来源与统计口径。",3,2},
      {"实验室设备预约管理系统","信息管理","完成设备预约、冲突检查与使用记录管理。","掌握数据库约束与业务流程设计。",3,1},
      {"个人知识库检索工具设计","软件工具","实现文档分类、关键词检索和本地内容管理。","熟悉文件处理、索引与基础界面开发。",3,2}
    };
    for (const auto& t : topics) db_.run("INSERT INTO topics(title,direction,description,requirements,teacher_id,capacity,created_at) VALUES(?,?,?,?,?,?,?)", {t[0],t[1],t[2],t[3],t[4],t[5],stamp});
    // Seed data are fictional. student01 remains unassigned for an end-to-end demo.
    db_.run("INSERT INTO selections(student_id,topic_id,status,created_at,reviewed_at) VALUES(5,1,'approved',?,?)", {stamp,stamp});
    db_.run("INSERT INTO selections(student_id,topic_id,status,created_at,reviewed_at) VALUES(6,2,'approved',?,?)", {stamp,stamp});
    db_.run("INSERT INTO selections(student_id,topic_id,status,created_at) VALUES(7,3,'pending',?)", {stamp});
    db_.run("INSERT INTO selections(student_id,topic_id,status,created_at,reviewed_at) VALUES(8,4,'approved',?,?)", {stamp,stamp});
    db_.run("INSERT INTO selections(student_id,topic_id,status,created_at,reviewed_at) VALUES(9,5,'approved',?,?)", {stamp,stamp});
    auto material = [&](int student, int selection, const std::string& stage, const std::string& status, int teacher) {
        std::string body = "毕业论文管理系统演示材料\n本文件为虚构示例，仅用于演示提交与审核流程。\n";
        auto id = db_.run("INSERT INTO submissions(student_id,selection_id,stage,version,filename,file_base64,file_size,summary,status,created_at) VALUES(?,?,?,1,?,?,?,?,?,?)", {student,selection,stage,stage == "proposal" ? "开题报告示例.txt" : "论文示例.txt",security::base64_encode(body),body.size(),"演示材料",status,stamp});
        if (status == "approved") db_.run("INSERT INTO reviews(submission_id,teacher_id,decision,comment,created_at) VALUES(?,?,'approved','研究内容和结构符合本阶段要求，请按计划继续完成。',?)", {id,teacher,stamp});
    };
    material(5,1,"proposal","approved",2); material(6,2,"proposal","pending",2);
    material(8,4,"proposal","approved",3); material(8,4,"thesis","pending",3);
    material(9,5,"proposal","approved",3); material(9,5,"thesis","approved",3);
    db_.run("INSERT INTO grades(student_id,teacher_id,process_score,thesis_score,defense_score,total,comment,updated_at) VALUES(9,3,90,88,92,89.6,'系统功能完整，报告结构清楚。',?)", {stamp});
    for (const auto& setting : Json::array({Json::array({"cohort", time_text(epoch(),"%Y") + " 学年"}), Json::array({"selection_deadline",time_text(epoch()+30*86400LL,"%Y-%m-%d")}), Json::array({"proposal_deadline",time_text(epoch()+60*86400LL,"%Y-%m-%d")}), Json::array({"thesis_deadline",time_text(epoch()+120*86400LL,"%Y-%m-%d")})}))
        db_.run("INSERT INTO settings(key,value) VALUES(?,?)", {setting[0],setting[1]});
    db_.run("INSERT INTO notices(title,body,author_id,created_at) VALUES('毕业论文工作安排','请先完成选题，经指导教师确认后提交开题报告。开题通过后方可提交论文，所有阶段以系统设置的截止日期为准。',1,?)", {stamp});
    db_.run("INSERT INTO notices(title,body,author_id,created_at) VALUES('演示数据说明','当前账号、姓名、课题和成绩均为虚构演示数据。可使用 student01 与 teacher01 演示从选题到评分的完整流程。',1,?)", {stamp});
    audit(1,"初始化","创建虚构演示数据"); tx.commit();
}

void Application::audit(long long uid, const std::string& action, const std::string& detail) {
    db_.run("INSERT INTO audit_logs(user_id,action,detail,created_at) VALUES(?,?,?,?)", {uid,action,detail,now()});
}

Json Application::authenticate(const std::string& cookie) {
    auto token = session_token(cookie); require(!token.empty(), 401, "请先登录");
    auto user = db_.first("SELECT u.id,u.username,u.name,u.role,u.department,u.active FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1", {security::digest(token),epoch()});
    require(!user.is_null(), 401, "登录已失效，请重新登录"); return user;
}

HttpReply Application::login(const Json& input, const std::string& address) {
    auto username = text(input,"username",1,40), password = text(input,"password",1,128);
    auto key = address + ":" + username; auto& attempt = login_attempts_[key];
    if (epoch() - attempt.second > 60) attempt = {0,epoch()};
    require(attempt.first < 10, 429, "登录尝试过多，请一分钟后重试");
    auto user = db_.first("SELECT * FROM users WHERE username=?", {username});
    // A fixed dummy hash keeps the expensive check on unknown accounts too.
    static const std::string dummy = security::password_hash("not-a-real-account");
    bool valid = security::password_matches(password, user.is_null() ? dummy : user["password_hash"].get<std::string>());
    if (!valid || user.is_null() || user["active"] != 1) { ++attempt.first; throw ApiError(401,"账号或密码错误，或账号已停用"); }
    login_attempts_.erase(key); if (login_attempts_.size() > 2000) login_attempts_.clear();
    auto token = security::hex(security::random_bytes(32)); Transaction tx(db_);
    db_.run("DELETE FROM sessions WHERE expires_at<=?", {epoch()});
    db_.run("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", {security::digest(token),user["id"],epoch()+8*3600});
    audit(user["id"],"登录","登录系统"); tx.commit();
    auto response = ok({{"message","登录成功"}});
    response.cookie = "THESIS_SESSION="+token+"; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800"; return response;
}

Json Application::state(const Json& u) {
    auto uid = u["id"]; std::string role = u["role"];
    Json result = {{"user",u},{"current_date",today()},{"version","1.0.0"}};
    result["settings"] = Json::object();
    for (const auto& row : db_.query("SELECT key,value FROM settings")) result["settings"][row["key"].get<std::string>()] = row["value"];
    result["topics"] = db_.query("SELECT t.*,u.name teacher_name,(SELECT COUNT(*) FROM selections s WHERE s.topic_id=t.id AND s.status='approved') approved_count,(SELECT COUNT(*) FROM selections s WHERE s.topic_id=t.id AND s.status='pending') pending_count FROM topics t JOIN users u ON u.id=t.teacher_id ORDER BY t.id DESC");
    std::string visible = role == "admin" ? "1=1" : role == "teacher" ? "t.teacher_id=?" : "s.student_id=?";
    Json params = role == "admin" ? Json::array() : Json::array({uid});
    result["selections"] = db_.query("SELECT s.*,u.name student_name,u.username student_username,t.title topic_title,t.teacher_id,t.direction,v.name teacher_name FROM selections s JOIN users u ON u.id=s.student_id JOIN topics t ON t.id=s.topic_id JOIN users v ON v.id=t.teacher_id WHERE "+visible+" ORDER BY s.id DESC",params);
    result["submissions"] = db_.query("SELECT f.id,f.student_id,f.selection_id,f.stage,f.version,f.filename,f.file_size,f.summary,f.status,f.created_at,u.name student_name,t.title topic_title,t.teacher_id FROM submissions f JOIN selections s ON s.id=f.selection_id JOIN topics t ON t.id=s.topic_id JOIN users u ON u.id=f.student_id WHERE "+visible+" ORDER BY f.id DESC",params);
    result["reviews"] = db_.query("SELECT r.*,v.name teacher_name FROM reviews r JOIN submissions f ON f.id=r.submission_id JOIN selections s ON s.id=f.selection_id JOIN topics t ON t.id=s.topic_id JOIN users v ON v.id=r.teacher_id WHERE "+visible+" ORDER BY r.id DESC",params);
    std::string grade_visible = role == "admin" ? "1=1" : role == "teacher" ? "g.teacher_id=?" : "g.student_id=?";
    result["grades"] = db_.query("SELECT g.*,u.name student_name,u.username student_username,v.name teacher_name FROM grades g JOIN users u ON u.id=g.student_id JOIN users v ON v.id=g.teacher_id WHERE "+grade_visible+" ORDER BY g.updated_at DESC",params);
    std::string user_visible = role == "admin" ? "1=1" : role == "student" ? "role='teacher' OR id=?" : "role='teacher' OR id IN (SELECT s.student_id FROM selections s JOIN topics t ON t.id=s.topic_id WHERE t.teacher_id=?)";
    result["users"] = db_.query("SELECT id,username,name,role,department,active,created_at FROM users WHERE "+user_visible+" ORDER BY role,id",params);
    result["notices"] = db_.query("SELECT n.*,u.name author_name FROM notices n JOIN users u ON u.id=n.author_id ORDER BY n.id DESC LIMIT 30");
    result["logs"] = db_.query("SELECT a.*,u.name user_name FROM audit_logs a JOIN users u ON u.id=a.user_id WHERE "+std::string(role=="admin"?"1=1":"a.user_id=?")+" ORDER BY a.id DESC LIMIT 20",params);
    return result;
}

Json Application::mutate(const std::string& path, const Json& in, const Json& user) {
    auto uid = user["id"]; std::string role = user["role"];
    auto need_role = [&](const std::string& expected) { require(role == expected,403,"没有此操作的权限"); };
    auto deadline = [&](const std::string& key) { auto setting=db_.first("SELECT value FROM settings WHERE key=?",{key}); require(!setting.is_null() && today()<=setting["value"].get<std::string>(),409,"已超过本阶段截止日期，请联系管理员"); };
    if (path == "/api/topics") {
        require(role=="teacher" || role=="admin",403,"只有教师和管理员可以发布课题");
        auto teacher = role=="teacher" ? uid.get<long long>() : integer(in,"teacher_id");
        require(db_.scalar("SELECT COUNT(*) FROM users WHERE id=? AND role='teacher' AND active=1",{teacher})==1,400,"指导教师不存在或已停用");
        auto id=db_.run("INSERT INTO topics(title,direction,description,requirements,teacher_id,capacity,created_at) VALUES(?,?,?,?,?,?,?)", {text(in,"title",6,240),text(in,"direction",2,60),text(in,"description",6,3000),text(in,"requirements",3,1500),teacher,integer(in,"capacity",1,10),now()});
        return {{"message","课题发布成功"},{"id",id}};
    }
    if (path == "/api/topics/update") {
        require(role=="teacher" || role=="admin",403,"只有教师和管理员可以编辑课题");
        auto id=integer(in,"id"); auto t=db_.first("SELECT * FROM topics WHERE id=?",{id}); require(!t.is_null(),404,"课题不存在");
        require(role=="admin" || t["teacher_id"]==uid,403,"只能编辑自己发布的课题");
        require(db_.scalar("SELECT COUNT(*) FROM selections WHERE topic_id=? AND status='approved'",{id})==0,409,"已有学生确认该课题，课题信息不可修改");
        db_.run("UPDATE topics SET title=?,direction=?,description=?,requirements=?,capacity=? WHERE id=?", {text(in,"title",6,240),text(in,"direction",2,60),text(in,"description",6,3000),text(in,"requirements",3,1500),integer(in,"capacity",1,10),id});
        return {{"message","课题信息已更新"},{"id",id}};
    }
    if (path == "/api/select") {
        need_role("student"); deadline("selection_deadline"); auto topic=integer(in,"topic_id");
        require(db_.scalar("SELECT COUNT(*) FROM selections WHERE student_id=? AND status IN ('pending','approved')",{uid})==0,409,"你已有待审核或已确认的选题");
        auto t=db_.first("SELECT t.* FROM topics t JOIN users u ON u.id=t.teacher_id WHERE t.id=? AND u.active=1",{topic}); require(!t.is_null(),404,"课题不存在");
        require(db_.scalar("SELECT COUNT(*) FROM selections WHERE topic_id=? AND status='approved'",{topic})<t["capacity"].get<long long>(),409,"该课题名额已满");
        auto id=db_.run("INSERT INTO selections(student_id,topic_id,status,created_at) VALUES(?,?,'pending',?)",{uid,topic,now()}); return {{"message","选题申请已提交，等待教师确认"},{"id",id}};
    }
    if (path == "/api/selections/cancel") {
        need_role("student"); auto id=integer(in,"id");
        auto s=db_.first("SELECT * FROM selections WHERE id=? AND student_id=?",{id,uid}); require(!s.is_null(),404,"申请不存在"); require(s["status"]=="pending",409,"只能撤回待审核的选题");
        db_.run("UPDATE selections SET status='cancelled',reviewed_at=? WHERE id=?",{now(),id}); return {{"message","选题申请已撤回"},{"id",id}};
    }
    if (path == "/api/assign") {
        need_role("admin"); auto student=integer(in,"student_id"),topic=integer(in,"topic_id");auto reason=text(in,"reason",3,1000);
        require(db_.scalar("SELECT COUNT(*) FROM users WHERE id=? AND role='student' AND active=1",{student})==1,400,"学生不存在或已停用");
        require(db_.scalar("SELECT COUNT(*) FROM selections WHERE student_id=? AND status='approved'",{student})==0,409,"学生已有确认的课题");
        auto t=db_.first("SELECT t.* FROM topics t JOIN users u ON u.id=t.teacher_id WHERE t.id=? AND u.active=1",{topic});require(!t.is_null(),404,"课题不存在");
        require(db_.scalar("SELECT COUNT(*) FROM selections WHERE topic_id=? AND status='approved'",{topic})<t["capacity"].get<long long>(),409,"该课题名额已满");
        db_.run("UPDATE selections SET status='cancelled',comment='管理员分配课题，原申请关闭',reviewed_at=? WHERE student_id=? AND status='pending'",{now(),student});
        auto id=db_.run("INSERT INTO selections(student_id,topic_id,status,comment,created_at,reviewed_at) VALUES(?,?,'approved',?,?,?)",{student,topic,reason,now(),now()});
        return {{"message","课题与指导关系已分配"},{"id",id}};
    }
    if (path == "/api/selections/review") {
        need_role("teacher"); auto id=integer(in,"id"); auto decision=text(in,"decision",1,20), comment=text(in,"comment",0,1000);
        require(decision=="approved" || decision=="rejected",400,"无效的审核结果");
        auto s=db_.first("SELECT s.*,t.teacher_id,t.capacity FROM selections s JOIN topics t ON t.id=s.topic_id WHERE s.id=?",{id}); require(!s.is_null(),404,"申请不存在");
        require(s["teacher_id"]==uid,403,"只能审核自己课题下的申请"); require(s["status"]=="pending",409,"该申请已处理");
        if (decision=="approved") require(db_.scalar("SELECT COUNT(*) FROM selections WHERE topic_id=? AND status='approved'",{s["topic_id"]})<s["capacity"].get<long long>(),409,"课题名额已满，请拒绝该申请");
        if (decision=="rejected") require(!comment.empty(),400,"拒绝选题时请填写原因");
        db_.run("UPDATE selections SET status=?,comment=?,reviewed_at=? WHERE id=?",{decision,comment,now(),id}); return {{"message","选题审核已保存"},{"id",id}};
    }
    if (path == "/api/submissions") {
        need_role("student"); auto stage=text(in,"stage",1,20); require(stage=="proposal"||stage=="thesis",400,"无效的材料阶段"); deadline(stage=="proposal"?"proposal_deadline":"thesis_deadline");
        auto s=db_.first("SELECT * FROM selections WHERE student_id=? AND status='approved'",{uid}); require(!s.is_null(),409,"请先完成选题并获得教师确认");
        require(db_.scalar("SELECT COUNT(*) FROM grades WHERE student_id=?",{uid})==0,409,"成绩已录入，材料已归档");
        auto last=db_.first("SELECT status,version FROM submissions WHERE student_id=? AND stage=? ORDER BY version DESC LIMIT 1",{uid,stage});
        require(last.is_null() || last["status"]=="changes",409,"上一版本正在审核或已通过，不能重复提交");
        if (stage=="thesis") { auto proposal=db_.first("SELECT status FROM submissions WHERE student_id=? AND stage='proposal' ORDER BY version DESC LIMIT 1",{uid}); require(!proposal.is_null() && proposal["status"]=="approved",409,"开题报告通过后才能提交论文"); }
        auto filename=text(in,"filename",1,180); require(filename.find_first_of("/\\\r\n") == std::string::npos,400,"文件名不能含路径或换行");
        auto dot=filename.find_last_of('.'); require(dot!=std::string::npos,400,"文件必须包含扩展名"); auto ext=filename.substr(dot); std::transform(ext.begin(),ext.end(),ext.begin(),[](unsigned char c){return char(std::tolower(c));});
        require(ext==".pdf"||ext==".doc"||ext==".docx"||ext==".txt",400,"仅支持 PDF、DOC、DOCX 和 TXT 文件");
        auto base64=text(in,"file_base64",4,6990508); std::string bytes;
        try { bytes=security::base64_decode(base64); } catch(...) { throw ApiError(400,"文件编码无效"); }
        require(!bytes.empty() && bytes.size()<=5242880,400,"文件大小应在 1 字节到 5 MB 之间");
        // Verify content signatures so renamed files cannot bypass the extension check.
        auto signature=[&](const std::string& sig){return bytes.size()>=sig.size()&&std::equal(sig.begin(),sig.end(),bytes.begin());};
        if(ext==".pdf") require(signature("%PDF-"),400,"文件内容与 PDF 格式不符，请重新选择文件");
        else if(ext==".doc") require(signature(std::string("\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1",8)),400,"文件内容与 DOC 格式不符，请重新选择文件");
        else if(ext==".docx") require(signature(std::string("PK\x03\x04",4)),400,"文件内容与 DOCX 格式不符，请重新选择文件");
        else require(bytes.find('\0')==std::string::npos,400,"TXT 文件包含无效内容，请重新选择文件");
        auto version=last.is_null()?1:last["version"].get<int>()+1;
        auto id=db_.run("INSERT INTO submissions(student_id,selection_id,stage,version,filename,file_base64,file_size,summary,status,created_at) VALUES(?,?,?,?,?,?,?,?,'pending',?)",{uid,s["id"],stage,version,filename,base64,bytes.size(),text(in,"summary",0,3000),now()});
        return {{"message","材料提交成功，等待教师审核"},{"id",id},{"version",version}};
    }
    if (path == "/api/reviews") {
        need_role("teacher"); auto id=integer(in,"submission_id"); auto decision=text(in,"decision",1,20),comment=text(in,"comment",3,3000);
        require(decision=="approved"||decision=="changes",400,"无效的审核结果");
        auto f=db_.first("SELECT f.*,t.teacher_id FROM submissions f JOIN selections s ON s.id=f.selection_id JOIN topics t ON t.id=s.topic_id WHERE f.id=?",{id}); require(!f.is_null(),404,"材料不存在"); require(f["teacher_id"]==uid,403,"只能审核自己指导学生的材料"); require(f["status"]=="pending",409,"该版本已审核");
        require(db_.scalar("SELECT MAX(version) FROM submissions WHERE student_id=? AND stage=?",{f["student_id"],f["stage"]})==f["version"].get<long long>(),409,"只能审核最新版本");
        db_.run("INSERT INTO reviews(submission_id,teacher_id,decision,comment,created_at) VALUES(?,?,?,?,?)",{id,uid,decision,comment,now()});
        db_.run("UPDATE submissions SET status=? WHERE id=?",{decision,id}); return {{"message","审核意见已保存"},{"id",id}};
    }
    if (path == "/api/grades") {
        need_role("teacher"); auto student=integer(in,"student_id");
        auto s=db_.first("SELECT s.id FROM selections s JOIN topics t ON t.id=s.topic_id WHERE s.student_id=? AND s.status='approved' AND t.teacher_id=?",{student,uid}); require(!s.is_null(),403,"只能为自己指导的学生录入成绩");
        auto latest=db_.first("SELECT status FROM submissions WHERE student_id=? AND stage='thesis' ORDER BY version DESC LIMIT 1",{student}); require(!latest.is_null() && latest["status"]=="approved",409,"论文审核通过后才能录入成绩");
        auto process=score(in,"process_score"),thesis=score(in,"thesis_score"),defense=score(in,"defense_score"),total=std::round((process*.2+thesis*.5+defense*.3)*10)/10;
        auto previous=db_.first("SELECT * FROM grades WHERE student_id=?",{student});
        db_.run("INSERT INTO grades(student_id,teacher_id,process_score,thesis_score,defense_score,total,comment,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET teacher_id=excluded.teacher_id,process_score=excluded.process_score,thesis_score=excluded.thesis_score,defense_score=excluded.defense_score,total=excluded.total,comment=excluded.comment,updated_at=excluded.updated_at",{student,uid,process,thesis,defense,total,text(in,"comment",3,3000),now()});
        if(!previous.is_null()) {
            std::ostringstream history;
            history<<"学生 ID "<<student<<" 成绩调整：过程 "<<previous["process_score"].dump()<<" → "<<process<<"，论文 "<<previous["thesis_score"].dump()<<" → "<<thesis
                   <<"，答辩 "<<previous["defense_score"].dump()<<" → "<<defense<<"，总评 "<<previous["total"].dump()<<" → "<<total;
            audit(uid,"成绩变更",history.str());
        }
        return {{"message","成绩已保存"},{"student_id",student},{"total",total}};
    }
    if (path == "/api/users") {
        need_role("admin"); auto username=text(in,"username",3,32),name=text(in,"name",2,60),new_role=text(in,"role",1,20),password=text(in,"password",8,128);
        require(std::regex_match(username,std::regex("[A-Za-z0-9_]{3,32}")),400,"账号仅支持 3 到 32 位字母、数字和下划线");
        require(new_role=="student"||new_role=="teacher"||new_role=="admin",400,"无效的用户角色"); require(db_.scalar("SELECT COUNT(*) FROM users WHERE username=?",{username})==0,409,"该账号已存在");
        auto id=db_.run("INSERT INTO users(username,name,role,department,password_hash,created_at) VALUES(?,?,?,?,?,?)",{username,name,new_role,text(in,"department",2,120),security::password_hash(password),now()});
        return {{"message","用户已创建"},{"id",id}};
    }
    if (path == "/api/users/reset_password") {
        need_role("admin"); auto id=integer(in,"id"); auto password=text(in,"password",8,128);
        require(id!=uid.get<long long>(),409,"修改自己的密码请使用修改密码功能");
        require(db_.scalar("SELECT COUNT(*) FROM users WHERE id=?",{id})==1,404,"用户不存在");
        db_.run("UPDATE users SET password_hash=? WHERE id=?",{security::password_hash(password),id});
        db_.run("DELETE FROM sessions WHERE user_id=?",{id});
        return {{"message","密码已重置，该用户的登录已失效，请使用新密码重新登录"},{"id",id}};
    }
    if (path == "/api/users/toggle") {
        need_role("admin"); auto id=integer(in,"id"); require(id!=uid.get<long long>(),409,"不能停用当前登录账号"); auto target=db_.first("SELECT * FROM users WHERE id=?",{id}); require(!target.is_null(),404,"用户不存在");
        if (target["active"]==1) {
            require(db_.scalar("SELECT COUNT(*) FROM selections s JOIN topics t ON t.id=s.topic_id WHERE s.status IN ('pending','approved') AND (s.student_id=? OR t.teacher_id=?) AND NOT EXISTS(SELECT 1 FROM grades g WHERE g.student_id=s.student_id)",{id,id})==0,409,"该用户仍有未完成的论文任务，暂不能停用");
            if (target["role"]=="teacher") require(db_.scalar("SELECT COUNT(*) FROM topics WHERE teacher_id=?",{id})==0,409,"教师名下仍有课题，暂不能停用");
        }
        db_.run("UPDATE users SET active=1-active WHERE id=?",{id}); db_.run("DELETE FROM sessions WHERE user_id=?",{id}); return {{"message","用户状态已更新"},{"id",id}};
    }
    if (path == "/api/settings") {
        need_role("admin"); auto selection=text(in,"selection_deadline",10,10),proposal=text(in,"proposal_deadline",10,10),thesis=text(in,"thesis_deadline",10,10);
        require(valid_date(selection)&&valid_date(proposal)&&valid_date(thesis),400,"请填写有效的阶段日期"); require(selection<=proposal&&proposal<=thesis,400,"截止时间必须按选题、开题、论文的顺序排列");
        for (const auto& key : {"cohort","selection_deadline","proposal_deadline","thesis_deadline"}) db_.run("UPDATE settings SET value=? WHERE key=?",{text(in,key,key==std::string("cohort")?2:10,key==std::string("cohort")?60:10),key});
        return {{"message","阶段设置已保存"}};
    }
    if (path == "/api/notices") {
        need_role("admin"); auto id=db_.run("INSERT INTO notices(title,body,author_id,created_at) VALUES(?,?,?,?)",{text(in,"title",3,180),text(in,"body",3,5000),uid,now()}); return {{"message","公告已发布"},{"id",id}};
    }
    if (path == "/api/password") {
        auto old=text(in,"old_password",1,128),password=text(in,"new_password",8,128); auto hash=db_.first("SELECT password_hash FROM users WHERE id=?",{uid});
        require(security::password_matches(old,hash["password_hash"]),400,"原密码不正确"); require(old!=password,400,"新密码应与原密码不同");
        db_.run("UPDATE users SET password_hash=? WHERE id=?",{security::password_hash(password),uid}); db_.run("DELETE FROM sessions WHERE user_id=?",{uid}); return {{"message","密码已修改，请重新登录"}};
    }
    throw ApiError(404,"接口不存在");
}

HttpReply Application::download(long long id, const Json& user) {
    auto f=db_.first("SELECT f.*,t.teacher_id FROM submissions f JOIN selections s ON s.id=f.selection_id JOIN topics t ON t.id=s.topic_id WHERE f.id=?",{id}); require(!f.is_null(),404,"文件不存在");
    require(user["role"]=="admin" || f["student_id"]==user["id"] || (user["role"]=="teacher" && f["teacher_id"]==user["id"]),403,"无权下载该文件");
    HttpReply response; response.body=security::base64_decode(f["file_base64"]); response.content_type="application/octet-stream";
    response.headers["Content-Disposition"]="attachment; filename=material-"+std::to_string(id)+".bin; filename*=UTF-8''"+encoded_filename(f["filename"]);
    response.headers["Content-Security-Policy"]="sandbox; default-src 'none'"; return response;
}
HttpReply Application::export_csv(const Json& user) {
    require(user["role"]=="admin",403,"只有管理员可以导出统计"); auto data=state(user);
    std::string csv="\xEF\xBB\xBF账号,姓名,学院,课题,指导教师,选题状态,开题状态,论文状态,过程成绩,论文成绩,答辩成绩,总评\r\n";
    for (const auto& u : data["users"]) {
        if (u["role"]!="student") continue;
        Json s,proposal,thesis,grade;
        for (const auto& r:data["selections"]) if (r["student_id"]==u["id"] && (r["status"]=="approved"||r["status"]=="pending")) {s=r;break;}
        for (const auto& f:data["submissions"]) if (f["student_id"]==u["id"]) { if(f["stage"]=="proposal"&&proposal.is_null())proposal=f; if(f["stage"]=="thesis"&&thesis.is_null())thesis=f; }
        for (const auto& g:data["grades"]) if (g["student_id"]==u["id"])grade=g;
        std::vector<std::string> cells={u["username"],u["name"],u["department"],s.is_null()?"":s["topic_title"].get<std::string>(),s.is_null()?"":s["teacher_name"].get<std::string>(),s.is_null()?"未选题":s["status"].get<std::string>(),proposal.is_null()?"未提交":proposal["status"].get<std::string>(),thesis.is_null()?"未提交":thesis["status"].get<std::string>()};
        for(const auto& key:{"process_score","thesis_score","defense_score","total"})cells.push_back(grade.is_null()?"":grade[key].dump());
        for(size_t i=0;i<cells.size();++i){if(i)csv+=',';csv+=csv_cell(cells[i]);} csv+="\r\n";
    }
    HttpReply r;r.body=csv;r.content_type="text/csv; charset=utf-8";r.headers["Content-Disposition"]="attachment; filename=thesis-statistics.csv";return r;
}

HttpReply Application::handle(const HttpRequest& r) {
    std::lock_guard<std::mutex> lock(mutex_);
    try {
        if (r.method=="GET" && r.path=="/api/health") return ok({{"status","ok"},{"language","C++17"},{"database","SQLite"},{"version","1.0.0"}});
        Json input=Json::object();
        if(r.method=="POST") {
            require(r.requested_with=="ThesisApp",403,"请求来源校验失败");
            require(r.origin.empty() || r.origin=="http://"+r.host || r.origin=="https://"+r.host,403,"请求来源校验失败");
            input=Json::parse(r.body);require(input.is_object(),400,"请求体必须为 JSON 对象");
        }
        if(r.method=="POST"&&r.path=="/api/login")return login(input,r.remote_address);
        auto user=authenticate(r.cookie);
        if(r.method=="GET"&&r.path=="/api/state")return ok(state(user));
        if(r.method=="GET"&&r.path=="/api/export")return export_csv(user);
        if(r.method=="GET"&&std::regex_match(r.path,std::regex("/api/files/[0-9]{1,10}")))return download(std::stoll(r.path.substr(11)),user);
        require(r.method=="POST",404,"接口不存在");
        if(r.path=="/api/logout") {
            Transaction tx(db_);db_.run("DELETE FROM sessions WHERE token_hash=?",{security::digest(session_token(r.cookie))});audit(user["id"],"退出","退出系统");tx.commit();
            auto reply=ok({{"message","已退出登录"}});reply.cookie="THESIS_SESSION=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0";return reply;
        }
        Transaction tx(db_);auto output=mutate(r.path,input,user);audit(user["id"],r.path,output.dump());tx.commit();
        auto reply=ok(output);if(r.path=="/api/password")reply.cookie="THESIS_SESSION=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0";return reply;
    } catch(const ApiError& error) {auto r=ok({{"error",error.what()}});r.status=error.status;return r;}
      catch(const Json::exception&) {auto r=ok({{"error","请求格式或字段类型不正确"}});r.status=400;return r;}
      catch(const std::exception& error) {std::cerr<<"Request failed: "<<error.what()<<'\n';auto r=ok({{"error","服务器处理失败，请重试"}});r.status=500;return r;}
}
