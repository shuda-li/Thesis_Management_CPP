#pragma once
#include "json.hpp"
#include "sqlite3.h"
#include <stdexcept>
#include <string>

using Json = nlohmann::json;

// RAII owns each SQLite handle and statement. All values use bound parameters.
class Database {
    sqlite3* handle_ = nullptr;
    class Statement {
    public:
        sqlite3_stmt* value = nullptr;
        Statement(sqlite3* db, const std::string& sql, Json params) {
            // A single Json scalar in braces can select the Json copy constructor.
            // Normalize it to a one-element parameter list before numeric indexing.
            if (!params.is_array()) params = Json::array({params});
            if (sqlite3_prepare_v2(db, sql.c_str(), -1, &value, nullptr) != SQLITE_OK)
                throw std::runtime_error(sqlite3_errmsg(db));
            try {
                for (size_t i = 0; i < params.size(); ++i) {
                    const auto& v = params[i];
                    int rc;
                    if (v.is_null()) rc = sqlite3_bind_null(value, int(i + 1));
                    else if (v.is_number_integer()) rc = sqlite3_bind_int64(value, int(i + 1), v.get<long long>());
                    else if (v.is_number()) rc = sqlite3_bind_double(value, int(i + 1), v.get<double>());
                    else if (v.is_boolean()) rc = sqlite3_bind_int(value, int(i + 1), v.get<bool>());
                    else {
                        const auto& s = v.get_ref<const std::string&>();
                        rc = sqlite3_bind_text(value, int(i + 1), s.c_str(), int(s.size()), SQLITE_TRANSIENT);
                    }
                    if (rc != SQLITE_OK) throw std::runtime_error("SQLite parameter binding failed");
                }
            } catch (...) { sqlite3_finalize(value); value = nullptr; throw; }
        }
        ~Statement() { sqlite3_finalize(value); }
        Statement(const Statement&) = delete;
        Statement& operator=(const Statement&) = delete;
    };
public:
    explicit Database(const std::string& path) {
        if (sqlite3_open_v2(path.c_str(), &handle_, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK) {
            std::string error = handle_ ? sqlite3_errmsg(handle_) : "SQLite allocation failed";
            sqlite3_close(handle_); throw std::runtime_error(error);
        }
        sqlite3_busy_timeout(handle_, 5000);
        exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    }
    ~Database() { sqlite3_close(handle_); }
    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;
    void exec(const std::string& sql) {
        char* error = nullptr;
        if (sqlite3_exec(handle_, sql.c_str(), nullptr, nullptr, &error) != SQLITE_OK) {
            std::string msg = error ? error : "SQLite error";
            sqlite3_free(error); throw std::runtime_error(msg);
        }
    }
    long long run(const std::string& sql, const Json& params = Json::array()) {
        Statement s(handle_, sql, params);
        if (sqlite3_step(s.value) != SQLITE_DONE) throw std::runtime_error(sqlite3_errmsg(handle_));
        return sqlite3_last_insert_rowid(handle_);
    }
    Json query(const std::string& sql, const Json& params = Json::array()) {
        Statement s(handle_, sql, params);
        Json rows = Json::array(); int rc;
        while ((rc = sqlite3_step(s.value)) == SQLITE_ROW) {
            Json row = Json::object();
            for (int i = 0; i < sqlite3_column_count(s.value); ++i) {
                const std::string key = sqlite3_column_name(s.value, i);
                switch (sqlite3_column_type(s.value, i)) {
                case SQLITE_INTEGER: row[key] = sqlite3_column_int64(s.value, i); break;
                case SQLITE_FLOAT: row[key] = sqlite3_column_double(s.value, i); break;
                case SQLITE_NULL: row[key] = nullptr; break;
                default: row[key] = std::string(reinterpret_cast<const char*>(sqlite3_column_text(s.value, i)), sqlite3_column_bytes(s.value, i));
                }
            }
            rows.push_back(std::move(row));
        }
        if (rc != SQLITE_DONE) throw std::runtime_error(sqlite3_errmsg(handle_));
        return rows;
    }
    Json first(const std::string& sql, const Json& params = Json::array()) {
        auto rows = query(sql, params);
        return rows.empty() ? Json() : rows[0];
    }
    long long scalar(const std::string& sql, const Json& params = Json::array()) {
        auto row = first(sql, params);
        return row.is_null() ? 0 : row.begin().value().get<long long>();
    }
};

class Transaction {
    Database& db_;
    bool committed_ = false;
public:
    explicit Transaction(Database& db) : db_(db) { db_.exec("BEGIN IMMEDIATE"); }
    void commit() { db_.exec("COMMIT"); committed_ = true; }
    ~Transaction() { if (!committed_) { try { db_.exec("ROLLBACK"); } catch (...) {} } }
};
