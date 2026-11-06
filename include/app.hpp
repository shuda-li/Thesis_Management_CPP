#pragma once
#include "database.hpp"
#include <map>
#include <mutex>
#include <string>

struct HttpRequest {
    std::string method, path, body, cookie, origin, host, requested_with, remote_address;
};
struct HttpReply {
    int status = 200;
    std::string body, content_type = "application/json; charset=utf-8", cookie;
    std::map<std::string, std::string> headers;
};
class ApiError : public std::runtime_error {
public:
    int status;
    ApiError(int code, const std::string& text) : std::runtime_error(text), status(code) {}
};
class Application {
    Database db_;
    std::mutex mutex_;
    std::map<std::string, std::pair<int, long long>> login_attempts_;
    void seed();
    Json authenticate(const std::string& cookie);
    Json state(const Json& user);
    Json mutate(const std::string& path, const Json& input, const Json& user);
    HttpReply login(const Json& input, const std::string& address);
    HttpReply download(long long id, const Json& user);
    HttpReply export_csv(const Json& user);
    void audit(long long user_id, const std::string& action, const std::string& detail);
public:
    Application(const std::string& database_path, const std::string& schema_path);
    HttpReply handle(const HttpRequest& request);
};
