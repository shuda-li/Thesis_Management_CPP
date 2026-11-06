#include "app.hpp"
#include "httplib.h"
#include <filesystem>
#include <fstream>
#include <iostream>
#ifdef _WIN32
#include <windows.h>
#endif

namespace fs = std::filesystem;
#ifdef _WIN32
// Narrow argv arrives in the active code page (e.g. GBK). Convert through the
// wide API so non-ASCII --root/--data paths resolve correctly on Windows.
static fs::path arg_path(const std::string& s) {
    int n = MultiByteToWideChar(CP_ACP, 0, s.c_str(), int(s.size()), nullptr, 0);
    std::wstring wide(size_t(n), L'\0');
    MultiByteToWideChar(CP_ACP, 0, s.c_str(), int(s.size()), &wide[0], n);
    return fs::path(wide);
}
#else
static fs::path arg_path(const std::string& s) { return fs::path(s); }
#endif
int main(int argc,char** argv) {
    try {
        int port=8080; std::string host="127.0.0.1"; fs::path root=fs::current_path(),data;
        if(!fs::exists(root/"database/schema.sql")) {
            auto executable=fs::absolute(arg_path(argv[0])); auto candidate=executable.parent_path().parent_path();
            if(fs::exists(candidate/"database/schema.sql"))root=candidate;
        }
        for(int i=1;i<argc;++i) {
            std::string key=argv[i];
            if(key=="--help") { std::cout<<"Usage: thesis_manager [--port 8080] [--host 127.0.0.1] [--root directory] [--data directory]\n";return 0; }
            if(i+1>=argc)throw std::runtime_error("Missing argument for "+key);
            std::string value=argv[++i];
            if(key=="--port") {size_t used=0;port=std::stoi(value,&used);if(used!=value.size()||port<1||port>65535)throw std::runtime_error("Invalid port");}
            else if(key=="--host")host=value;
            else if(key=="--root")root=fs::absolute(arg_path(value));
            else if(key=="--data")data=fs::absolute(arg_path(value));
            else throw std::runtime_error("Unknown argument: "+key);
        }
        if(data.empty()) data=root/"data";
        fs::create_directories(data);
        Application app((data/"thesis.db").string(),(root/"database/schema.sql").string());
        httplib::Server server; server.new_task_queue=[] {return new httplib::ThreadPool(4,32);};
        server.set_payload_max_length(8*1024*1024);server.set_read_timeout(10,0);server.set_write_timeout(10,0);server.set_keep_alive_max_count(20);
        auto api=[&](const httplib::Request& req,httplib::Response& res) {
            HttpRequest in{req.method,req.path,req.body,req.get_header_value("Cookie"),req.get_header_value("Origin"),req.get_header_value("Host"),req.get_header_value("X-Requested-With"),req.remote_addr};
            auto out=app.handle(in);res.status=out.status;res.set_content(out.body,out.content_type);
            if(!out.cookie.empty())res.set_header("Set-Cookie",out.cookie);
            for(const auto& [key,value]:out.headers)res.set_header(key,value);
        };
        server.Get(R"(/api/.*)",api);server.Post(R"(/api/.*)",api);
        server.Get(R"(/|/index.html|/app.js|/style.css|/favicon.svg)",[&](const httplib::Request& req,httplib::Response& res) {
            std::string name=req.path=="/"?"index.html":req.path.substr(1);std::ifstream file(root/"web"/name,std::ios::binary);
            if(!file){res.status=404;res.set_content("File not found","text/plain");return;}
            std::string body((std::istreambuf_iterator<char>(file)),{});
            auto type=name=="app.js"?"text/javascript; charset=utf-8":name=="style.css"?"text/css; charset=utf-8":name=="favicon.svg"?"image/svg+xml":"text/html; charset=utf-8";
            res.set_content(body,type);
        });
        server.set_error_handler([](const httplib::Request&,httplib::Response& res) {
            if(res.body.empty())res.set_content("{\"error\":\"请求不存在或超过大小限制\"}","application/json; charset=utf-8");
        });
        server.set_post_routing_handler([](const httplib::Request&,httplib::Response& res) {
            res.set_header("X-Content-Type-Options","nosniff");res.set_header("X-Frame-Options","DENY");res.set_header("Referrer-Policy","same-origin");res.set_header("Cache-Control","no-store");
            if(!res.has_header("Content-Security-Policy"))res.set_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
        });
        std::cout<<"ThesisFlow - C++17 / SQLite\nOpen http://"<<host<<":"<<port<<"\nDatabase: "<<(data/"thesis.db").string()<<"\nPress Ctrl+C to stop.\n"<<std::flush;
        if(!server.listen(host,port)){std::cerr<<"Cannot listen. The port may be in use.\n";return 1;}
    } catch(const std::exception& error){std::cerr<<"Startup failed: "<<error.what()<<'\n';return 1;}
    return 0;
}
