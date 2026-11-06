#pragma once
#include "picosha2.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <vector>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#endif

namespace security {
using Bytes = std::vector<unsigned char>;
inline Bytes sha256(const Bytes& b) {
    Bytes out(32); picosha2::hash256(b.begin(), b.end(), out.begin(), out.end()); return out;
}
inline std::string hex(const Bytes& b) {
    const char* digits = "0123456789abcdef"; std::string out;
    for (auto c : b) { out += digits[c >> 4]; out += digits[c & 15]; } return out;
}
inline std::string digest(const std::string& s) { return hex(sha256(Bytes(s.begin(), s.end()))); }
inline Bytes unhex(const std::string& s) {
    if (s.size() % 2) throw std::runtime_error("Invalid hexadecimal length");
    auto digit = [](char c) -> int { if (c >= '0' && c <= '9') return c - '0'; if (c >= 'a' && c <= 'f') return c - 'a' + 10; throw std::runtime_error("Invalid hex"); };
    Bytes b; for (size_t i = 0; i < s.size(); i += 2) b.push_back(static_cast<unsigned char>(digit(s[i]) * 16 + digit(s[i + 1]))); return b;
}
inline Bytes random_bytes(size_t n) {
    Bytes b(n);
#ifdef _WIN32
    if (BCryptGenRandom(nullptr, b.data(), static_cast<ULONG>(n), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) throw std::runtime_error("Secure random generator failed");
#else
    std::ifstream source("/dev/urandom", std::ios::binary);
    if (!source.read(reinterpret_cast<char*>(b.data()), std::streamsize(n))) throw std::runtime_error("Secure random generator failed");
#endif
    return b;
}
inline Bytes hmac(Bytes key, const Bytes& input) {
    if (key.size() > 64) key = sha256(key);
    key.resize(64, 0);
    Bytes inner(64), outer(64);
    for (size_t i = 0; i < 64; ++i) { inner[i] = key[i] ^ 0x36; outer[i] = key[i] ^ 0x5c; }
    inner.insert(inner.end(), input.begin(), input.end()); auto h = sha256(inner);
    outer.insert(outer.end(), h.begin(), h.end()); return sha256(outer);
}
// PBKDF2 with one 32-byte block. Test vectors are checked by tests/security_test.cpp.
inline Bytes pbkdf2(const std::string& password, const Bytes& salt, int rounds) {
    Bytes key(password.begin(), password.end()), block = salt;
    block.insert(block.end(), {0, 0, 0, 1}); Bytes u = hmac(key, block), out = u;
    for (int i = 1; i < rounds; ++i) { u = hmac(key, u); for (size_t j = 0; j < out.size(); ++j) out[j] ^= u[j]; } return out;
}
inline bool equal(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char diff = 0;
    for (size_t i = 0; i < a.size(); ++i) diff |= static_cast<unsigned char>(a[i] ^ b[i]);
    return diff == 0;
}
inline std::string password_hash(const std::string& password) {
    auto salt = random_bytes(16); return "120000$" + hex(salt) + "$" + hex(pbkdf2(password, salt, 120000));
}
inline bool password_matches(const std::string& password, const std::string& stored) {
    try {
        size_t a = stored.find('$'), b = stored.find('$', a + 1);
        if (a == std::string::npos || b == std::string::npos) return false;
        int rounds = std::stoi(stored.substr(0, a)); if (rounds != 120000) return false;
        return equal(hex(pbkdf2(password, unhex(stored.substr(a + 1, b - a - 1)), rounds)), stored.substr(b + 1));
    } catch (...) { return false; }
}
inline std::string base64_encode(const std::string& bytes) {
    static const char* alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out; unsigned val = 0; int bits = -6;
    for (unsigned char c : bytes) { val = (val << 8) | c; bits += 8; while (bits >= 0) { out += alphabet[(val >> bits) & 63]; bits -= 6; } }
    if (bits > -6) out += alphabet[((val << 8) >> (bits + 8)) & 63];
    while (out.size() % 4) out += '=';
    return out;
}
inline std::string base64_decode(const std::string& text) {
    if (text.empty() || text.size() % 4) throw std::runtime_error("Invalid Base64");
    const std::string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out; unsigned val = 0; int bits = -8;
    for (size_t i = 0; i < text.size(); ++i) {
        if (text[i] == '=') {
            if (i < text.size() - 2 || text.find_first_not_of('=', i) != std::string::npos) throw std::runtime_error("Invalid Base64 padding");
            break;
        }
        auto p = alphabet.find(text[i]); if (p == std::string::npos) throw std::runtime_error("Invalid Base64 character");
        val = (val << 6) | unsigned(p); bits += 6; if (bits >= 0) { out += char((val >> bits) & 255); bits -= 8; }
    }
    if (base64_encode(out) != text) throw std::runtime_error("Noncanonical Base64");
    return out;
}
} // namespace security
