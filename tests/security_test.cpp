#include "security.hpp"
#include <iostream>
void check(bool condition,const char* message){if(!condition)throw std::runtime_error(message);}
int main(){
 try {
  check(security::digest("abc")=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","SHA256 vector");
  security::Bytes salt={'s','a','l','t'};
  check(security::hex(security::pbkdf2("password",salt,1))=="120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b","PBKDF2 iteration 1");
  check(security::hex(security::pbkdf2("password",salt,2))=="ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43","PBKDF2 iteration 2");
  check(security::hex(security::pbkdf2("password",salt,4096))=="c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a","PBKDF2 iteration 4096");
  for(const std::string s:{"f","fo","foo","foob","fooba","foobar","毕业论文"})check(security::base64_decode(security::base64_encode(s))==s,"Base64 round trip");
  bool rejected=false;try{security::base64_decode("Zm9=");}catch(...){rejected=true;}check(rejected,"Noncanonical Base64 rejection");
  auto hash=security::password_hash("Demo@2026");check(security::password_matches("Demo@2026",hash),"Password verification");check(!security::password_matches("wrong",hash),"Wrong password");
  check(security::random_bytes(32).size()==32,"Secure random bytes");
  std::cout<<"PASS: 15 security vector and encoding checks\n";
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
