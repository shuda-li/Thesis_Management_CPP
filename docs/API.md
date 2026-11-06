# 接口说明

除 `/api/login` 与 `/api/health` 外，全部接口需要 `THESIS_SESSION` Cookie。Cookie 为 HttpOnly、SameSite=Strict、有效期 8 小时。服务端仅存令牌的 SHA256 摘要，检查账号启用状态。登录时需用户名和密码，不接受客户端声明角色。

POST 请求体为 JSON 对象，需携带 `Content-Type: application/json` 和 `X-Requested-With: ThesisApp`；存在 Origin 时必须与 Host 同源。不提供跨域访问。权限不足返回 403，未登录返回 401，业务状态冲突返回 409，字段无效返回 400，未知路径返回 404。

| 方法 | 路径 | 角色 | 主要字段 |
| --- | --- | --- | --- |
| GET | `/api/health` | 无需登录 | 服务语言、数据库、版本 |
| POST | `/api/login` | 无需登录 | username、password |
| POST | `/api/logout` | 全部已登录用户 | 空对象 |
| GET | `/api/state` | 全部已登录用户 | 返回当前角色可见的数据，无密码摘要和文件正文 |
| POST | `/api/topics` | 教师、管理员 | title、direction、description、requirements、capacity；管理员另传 teacher_id |
| POST | `/api/select` | 学生 | topic_id |
| POST | `/api/selections/cancel` | 学生 | 本人待审申请的 id |
| POST | `/api/selections/review` | 指导教师 | id、decision=approved/rejected、comment |
| POST | `/api/assign` | 管理员 | student_id、topic_id、reason；仅可分配未确认课题的学生 |
| POST | `/api/submissions` | 学生 | stage=proposal/thesis、filename、file_base64、summary |
| GET | `/api/files/{id}` | 本人、指导教师、管理员 | 材料 id；返回原文件字节与附件头 |
| POST | `/api/reviews` | 指导教师 | submission_id、decision=approved/changes、comment |
| POST | `/api/grades` | 指导教师 | student_id、process_score、thesis_score、defense_score、comment |
| POST | `/api/users` | 管理员 | username、name、role、department、password |
| POST | `/api/users/toggle` | 管理员 | id |
| POST | `/api/settings` | 管理员 | cohort、selection_deadline、proposal_deadline、thesis_deadline |
| POST | `/api/notices` | 管理员 | title、body |
| POST | `/api/password` | 全部已登录用户 | old_password、new_password |
| GET | `/api/export` | 管理员 | 含 UTF-8 BOM 的 CSV，转义引号与公式前缀 |

## 示例

申请课题：

```json
{"topic_id":1}
```

审核材料：

```json
{"submission_id":12,"decision":"changes","comment":"请补充需求分析和测试结果。"}
```

录入成绩：

```json
{"student_id":4,"process_score":90,"thesis_score":88,"defense_score":92,"comment":"功能完整，报告清楚。"}
```

响应中的 `total` 为 `89.6`。客户端传入的 `total` 不参与保存。成功响应含 `message`，必要时返回 id/version/total；失败响应为 `{"error":"原因"}`。

## 可见性

- 学生只读取本人选题、材料、审核和成绩，以及教师基本信息、全部课题和公告。
- 教师只读取本人课题下的学生、申请、材料和成绩；审核、下载及评分均按指导关系重新检查。
- 管理员可查看全部数据和导出统计，可以分配尚未确认的课题，但材料审核与评分仍由指导教师执行。
- 文件内容仅通过授权下载接口返回，不出现在 `/api/state` 中。
