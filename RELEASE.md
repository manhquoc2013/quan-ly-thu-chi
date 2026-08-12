# Phát hành — Quản Lý Tài Chính

## Luồng phát hành

```text
1. Dev trên nhánh feature/
2. Merge vào main qua Pull Request
3. Build & test: npm run build && npm run test
4. Cập nhật version trong package.json (+ CHANGELOG.md, RELEASE.md)
5. Commit: "Release vX.Y.Z"
6. Tag trên commit đã có trên main:
   git tag -a vX.Y.Z -m "…" && git push origin main && git push origin vX.Y.Z
7. GitHub Release (bắt buộc — tag ≠ release trên tab Releases):
   gh release create vX.Y.Z --title "vX.Y.Z — …" --notes-file - --latest
8. GitHub Actions deploy Pages — chỉ khi tag trỏ tới commit trên main
```

> **Lưu ý:** `git tag` chỉ tạo tag trên git. Tab **Releases** trên GitHub chỉ hiện mục đã tạo bằng `gh release create` (hoặc nút “Draft a new release”).
>
> **Deploy:** Workflow `deploy.yml` dùng **GitHub Actions → Pages** (`upload-pages-artifact` + `deploy-pages`). Tag ngoài `main` bị chặn.
>
> **Cấu hình repo (một lần):** Settings → Pages → Build and deployment → **Source = GitHub Actions** (không còn “Deploy from a branch / gh-pages”).

## Phiên bản hiện tại: v2.0.0

| Thành phần | Phiên bản |
|:---|:---|
| App | 2.0.0 |
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
- [ ] Tag trên commit đã merge vào `main` (deploy.yml sẽ reject tag ngoài main)
- [ ] Tạo GitHub Release (`gh release create …`) — không chỉ đẩy tag
