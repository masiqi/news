# **4. 数据模型 (Data Models)**

- **`User`**: 存储用户账户信息。
- **`Source`**: 存储用户订阅的RSS feed信息。
- **`Note`**: 记录系统为用户处理并生成的每一篇笔记的元数据。
- **`SyncCredential`**: 记录为用户生成的R2访问凭证的元数据，用于管理和撤销。
- *(还包含 `Category`, `UserInterest`, `SourceCategory` 等支持推荐功能的模型)*