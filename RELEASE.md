# Phát hành — Quản Lý Tài Chính

## Luồng phát hành

```text
1. Dev trên nhánh feature/
2. Merge vào main qua Pull Request
3. Build & test: npm run build && npm run test
4. Cập nhật version trong package.json
5. Commit: "Release vX.Y.Z"
6. Tag: git tag vX.Y.Z && git push origin vX.Y.Z
7. GitHub Actions tự deploy lên GitHub Pages
```

## Phiên bản hiện tại: v1.4.0

| Thành phần | Phiên bản |
|:---|:---|
| App | 1.4.0 |
| React | 19 |
| Vite | 6 |
| Tailwind CSS | 4 |
| Node.js | ≥ 20 |

## Kiểm tra trước khi release

- [ ] `npm run build` thành công
- [ ] `npx tsc --noEmit` không lỗi
- [ ] `npx vitest run` pass
- [ ] Test trên Chrome, Edge, Safari
- [ ] PWA cài được từ browser
- [ ] Đăng nhập/đăng ký Supabase hoạt động
- [ ] Cập nhật CHANGELOG.md
- [ ] Cập nhật version trong package.json
